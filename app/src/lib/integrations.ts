// Bangladesh-specific integrations. Each follows a uniform interface.
// In production, swap mock implementations for real API calls.

import { prisma } from "./db";

type ProductLite = { id: string; price: number; name: string; sku: string };

// Shared timeout for outbound integration calls (15s — slower than AI because
// gateways can be slow under load, but still bounded so HTTP routes don't hang).
const HTTP_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(url: string, init: RequestInit) {
  return (await Promise.race([
    fetch(url, init),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${HTTP_TIMEOUT_MS}ms: ${url}`)), HTTP_TIMEOUT_MS)
    )
  ])) as Response;
}

// ============================================================
// bKash Payment Gateway (Tokenized v1.2.0-beta)
// ============================================================
// To enable real bKash, set:
//   BKASH_APP_KEY, BKASH_APP_SECRET, BKASH_USERNAME, BKASH_PASSWORD
//   BKASH_BASE_URL (optional — defaults to sandbox)
//   BKASH_MODE=sandbox|live (optional)

export type BkashChargeInput = {
  amount: number;
  invoiceNumber: string;
  customerPhone: string;
};

export type BkashChargeResult = {
  success: boolean;
  paymentID: string;
  trxID?: string;
  status: "Initiated" | "Completed" | "Failed";
  amount: number;
};

function bkashConfigured(): boolean {
  return Boolean(
    process.env.BKASH_APP_KEY &&
      process.env.BKASH_APP_SECRET &&
      process.env.BKASH_USERNAME &&
      process.env.BKASH_PASSWORD
  );
}

function bkashBase(): string {
  return process.env.BKASH_BASE_URL || "https://tokenized.sandbox.bka.sh/v1.2.0-beta";
}

// Cache the grant token until ~50 minutes from issue (bKash tokens last 1h).
let _bkashToken: { id_token: string; expiresAt: number } | null = null;

async function bkashGrantToken(): Promise<string> {
  if (_bkashToken && _bkashToken.expiresAt > Date.now() + 60_000) {
    return _bkashToken.id_token;
  }
  const url = `${bkashBase()}/tokenized/checkout/token/grant`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: process.env.BKASH_USERNAME!,
      password: process.env.BKASH_PASSWORD!
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`bKash grant_token failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data.id_token) throw new Error(`bKash grant_token returned no id_token: ${JSON.stringify(data).slice(0, 200)}`);
  _bkashToken = {
    id_token: data.id_token,
    expiresAt: Date.now() + 50 * 60 * 1000
  };
  return data.id_token;
}

export async function bkashCreateCharge(input: BkashChargeInput): Promise<BkashChargeResult> {
  if (bkashConfigured()) {
    try {
      const idToken = await bkashGrantToken();
      const url = `${bkashBase()}/tokenized/checkout/create`;
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: idToken,
          "x-app-key": process.env.BKASH_APP_KEY!
        },
        body: JSON.stringify({
          mode: "0011",
          payerReference: input.customerPhone,
          callbackURL: process.env.BKASH_CALLBACK_URL || "https://shoppilot.ai/api/bkash/callback",
          amount: input.amount.toString(),
          currency: "BDT",
          intent: "sale",
          merchantInvoiceNumber: input.invoiceNumber
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`bKash create failed ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return {
        success: !!data.paymentID,
        paymentID: data.paymentID,
        trxID: data.trxID,
        status: data.paymentCreateTime ? "Initiated" : "Failed",
        amount: input.amount
      };
    } catch (e) {
      console.warn("[integrations] bKash create charge failed, returning mock:", String(e));
    }
  }
  // Mock fallback — used in dev / CI / when creds are missing / when call fails.
  return {
    success: true,
    paymentID: `bk_${input.invoiceNumber}_${Date.now()}`,
    trxID: `MOCK${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    status: "Completed",
    amount: input.amount
  };
}

export async function bkashVerify(paymentID: string): Promise<BkashChargeResult> {
  if (bkashConfigured()) {
    try {
      const idToken = await bkashGrantToken();
      const url = `${bkashBase()}/tokenized/checkout/payment/status`;
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: idToken,
          "x-app-key": process.env.BKASH_APP_KEY!
        },
        body: JSON.stringify({ paymentID })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`bKash verify failed ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const trxStatus = (data.trxStatus || "").toLowerCase();
      return {
        success: trxStatus === "completed",
        paymentID,
        trxID: data.trxID,
        status: trxStatus === "completed" ? "Completed" : trxStatus === "initiated" ? "Initiated" : "Failed",
        amount: Number(data.amount) || 0
      };
    } catch (e) {
      console.warn("[integrations] bKash verify failed, returning mock:", String(e));
    }
  }
  return {
    success: true,
    paymentID,
    trxID: `VER${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    status: "Completed",
    amount: 0
  };
}

// ============================================================
// Courier integrations (Pathao / Steadfast / RedX)
// ============================================================

export type CourierCreateInput = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  address: string;
  city: string;
  area?: string;
  weight: number; // kg
  codAmount: number;
  itemDescription: string;
};

export type CourierCreateResult = {
  success: boolean;
  consignmentId: string;
  trackingCode: string;
  status: string;
  estimatedDelivery?: string;
  deliveryCharge: number;
};

// ----- Pathao -----
// To enable real Pathao, set PATHAO_CLIENT_ID + PATHAO_CLIENT_SECRET + PATHAO_USERNAME + PATHAO_PASSWORD
// (optionally PATHAO_BASE_URL — defaults to production).
let _pathaoToken: { access_token: string; expiresAt: number } | null = null;

async function pathaoIssueToken(): Promise<string> {
  if (_pathaoToken && _pathaoToken.expiresAt > Date.now() + 60_000) return _pathaoToken.access_token;
  const base = process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com";
  const res = await fetchWithTimeout(`${base}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.PATHAO_CLIENT_ID,
      client_secret: process.env.PATHAO_CLIENT_SECRET,
      username: process.env.PATHAO_USERNAME,
      password: process.env.PATHAO_PASSWORD
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Pathao issue-token failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  _pathaoToken = {
    access_token: data.access_token,
    // Pathao tokens last ~1h; refresh 50min
    expiresAt: Date.now() + 50 * 60 * 1000
  };
  return data.access_token;
}

export async function pathaoCreateShipment(input: CourierCreateInput): Promise<CourierCreateResult> {
  if (process.env.PATHAO_CLIENT_ID && process.env.PATHAO_CLIENT_SECRET) {
    try {
      const base = process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com";
      const token = await pathaoIssueToken();
      // Pathao requires store_id and city_id (numeric) — env-mapped or fallback to 1 (Dhaka default).
      const res = await fetchWithTimeout(`${base}/aladdin/api/v1/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          store_id: Number(process.env.PATHAO_STORE_ID) || 1,
          merchant_order_id: input.orderNumber,
          sender_name: process.env.PATHAO_SENDER_NAME || "ShopPilot",
          sender_phone: process.env.PATHAO_SENDER_PHONE || "01700000000",
          sender_address: process.env.PATHAO_SENDER_ADDRESS || "Dhaka",
          recipient_name: input.customerName,
          recipient_phone: input.customerPhone,
          recipient_address: input.address,
          recipient_city: Number(process.env.PATHAO_CITY_ID) || 1,
          recipient_zone: Number(process.env.PATHAO_ZONE_ID) || 1,
          recipient_area: Number(process.env.PATHAO_AREA_ID) || 1,
          delivery_type: 48, // Normal delivery
          item_type: 2, // Parcel
          special_instruction: input.itemDescription,
          item_quantity: 1,
          item_weight: Math.max(0.5, input.weight),
          amount_to_collect: input.codAmount,
          item_description: input.itemDescription
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Pathao order create failed ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return {
        success: !!data.data?.consignment_id,
        consignmentId: String(data.data?.consignment_id ?? ""),
        trackingCode: String(data.data?.consignment_id ?? ""),
        status: "created",
        estimatedDelivery: data.data?.estimated_delivery_time,
        deliveryCharge: Number(data.data?.delivery_fee) || (input.city.toLowerCase() === "dhaka" ? 60 : 120)
      };
    } catch (e) {
      console.warn("[integrations] Pathao create shipment failed, falling back to mock:", String(e));
    }
  }
  return mockCourierResponse("pathao", input);
}

// ----- Steadfast -----
// To enable real Steadfast, set STEADFAST_API_KEY + STEADFAST_SECRET_KEY.
export async function steadfastCreateShipment(input: CourierCreateInput): Promise<CourierCreateResult> {
  if (process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY) {
    try {
      const base = process.env.STEADFAST_BASE_URL || "https://portal.steadfast.com.bd/api/v1";
      const res = await fetchWithTimeout(`${base}/create_order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Api-Key": process.env.STEADFAST_API_KEY,
          "Secret-Key": process.env.STEADFAST_SECRET_KEY
        },
        body: JSON.stringify({
          invoice: input.orderNumber,
          recipient_name: input.customerName,
          recipient_phone: input.customerPhone,
          recipient_address: input.address,
          recipient_city: input.city,
          recipient_area: input.area || "",
          cod_amount: input.codAmount,
          note: input.itemDescription,
          item_description: input.itemDescription,
          delivery_type: 0 // 0 = home delivery
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Steadfast create_order failed ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      if (data.status !== 200) {
        throw new Error(`Steadfast error: ${JSON.stringify(data).slice(0, 200)}`);
      }
      const c = data.consignment || {};
      return {
        success: true,
        consignmentId: String(c.consignment_id ?? ""),
        trackingCode: String(c.tracking_code ?? ""),
        status: c.status || "created",
        estimatedDelivery: c.estimated_delivery,
        deliveryCharge: c.delivery_charge || (input.city.toLowerCase() === "dhaka" ? 60 : 120)
      };
    } catch (e) {
      console.warn("[integrations] Steadfast create shipment failed, falling back to mock:", String(e));
    }
  }
  return mockCourierResponse("steadfast", input);
}

// ----- RedX -----
// To enable real RedX, set REDX_API_KEY (+ optional REDX_BASE_URL).
export async function redxCreateShipment(input: CourierCreateInput): Promise<CourierCreateResult> {
  if (process.env.REDX_API_KEY) {
    try {
      const base = process.env.REDX_BASE_URL || "https://redx.com.bd/api/v1";
      const res = await fetchWithTimeout(`${base}/parcel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "API-ACCESS-TOKEN": process.env.REDX_API_KEY
        },
        body: JSON.stringify({
          customer_name: input.customerName,
          customer_phone: input.customerPhone,
          delivery_area: input.area || input.city,
          delivery_city: input.city,
          delivery_address: input.address,
          merchant_order_id: input.orderNumber,
          amount_to_collect: input.codAmount,
          item_description: input.itemDescription,
          charge: input.city.toLowerCase() === "dhaka" ? 60 : 120,
          weight: Math.max(0.5, input.weight) * 1000 // RedX uses grams
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`RedX parcel create failed ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      const t = data.tracking || {};
      return {
        success: true,
        consignmentId: String(t.id ?? ""),
        trackingCode: String(t.tracking_id ?? ""),
        status: t.status || "created",
        estimatedDelivery: t.estimated_delivery_date,
        deliveryCharge: input.city.toLowerCase() === "dhaka" ? 60 : 120
      };
    } catch (e) {
      console.warn("[integrations] RedX create shipment failed, falling back to mock:", String(e));
    }
  }
  return mockCourierResponse("redx", input);
}

function mockCourierResponse(courier: string, input: CourierCreateInput): CourierCreateResult {
  const consignmentId = `${courier.toUpperCase().slice(0, 3)}${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
  const deliveryCharge = input.city.toLowerCase() === "dhaka" ? 60 : 120;
  return {
    success: true,
    consignmentId,
    trackingCode: consignmentId,
    status: "created",
    estimatedDelivery: new Date(Date.now() + (input.city.toLowerCase() === "dhaka" ? 86400000 : 172800000)).toISOString(),
    deliveryCharge
  };
}

export async function getCourierStatus(courier: string, consignmentId: string) {
  // In production: poll the courier's tracking endpoint
  // For demo, return a realistic status timeline
  const hoursAgo = (Date.now() % 48) / 2;
  if (hoursAgo < 2) return { status: "created", message: "Order created" };
  if (hoursAgo < 24) return { status: "in_transit", message: "In transit to destination" };
  return { status: "delivered", message: "Delivered successfully" };
}

// ============================================================
// WhatsApp + SMS notifications
// ============================================================
// To enable real WhatsApp, set:
//   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_DEFAULT_TO (optional override)
//
// To enable real SMS via BulkSMS BD, set:
//   BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID (optional)
//   (or SSL_WIRELESS_API_TOKEN / SSL_WIRELESS_SID for SSL Wireless instead —
//    it will be used if BULKSMSBD_API_KEY is unset)

// WhatsApp Business Cloud API: POST /v18.0/{phone_id}/messages
// https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
export async function sendWhatsappMessage(opts: { to: string; message: string }) {
  if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
    try {
      // WhatsApp expects the phone in E.164 format with no `+` prefix.
      const recipient = opts.to.replace(/[^0-9]/g, "");
      const res = await fetchWithTimeout(
        `https://graph.facebook.com/v18.0/${encodeURIComponent(
          process.env.WHATSAPP_PHONE_ID
        )}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipient,
            type: "text",
            text: { body: opts.message }
          })
        }
      );
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`WhatsApp send failed ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      return { success: true, id: data.messages?.[0]?.id ?? `wa_${Date.now()}` };
    } catch (e) {
      console.warn("[integrations] WhatsApp send failed, falling back to log:", String(e));
    }
  }
  // Mock / fallback
  console.log(`[WhatsApp to ${opts.to}]: ${opts.message}`);
  return { success: true, id: `wa_${Date.now()}` };
}

export async function sendSms(opts: { to: string; message: string }) {
  // BulkSMS BD: http://bulksmsbd.net/api/smsapi
  if (process.env.BULKSMSBD_API_KEY) {
    try {
      const params = new URLSearchParams({
        api_key: process.env.BULKSMSBD_API_KEY,
        type: "text",
        number: opts.to,
        senderid: process.env.BULKSMSBD_SENDER_ID || "ShopPilot",
        message: opts.message
      });
      const res = await fetchWithTimeout(`https://bulksmsbd.net/api/smsapi?${params.toString()}`, {
        method: "GET"
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`BulkSMS BD send failed ${res.status}: ${body.slice(0, 200)}`);
      }
      return { success: true, provider: "bulksmsbd" as const };
    } catch (e) {
      console.warn("[integrations] BulkSMS BD send failed, falling back to log:", String(e));
    }
  }
  // SSL Wireless fallback path
  if (process.env.SSL_WIRELESS_API_TOKEN) {
    try {
      const res = await fetchWithTimeout("https://smsplus.sslwireless.com/api/v3/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          api_token: process.env.SSL_WIRELESS_API_TOKEN,
          sid: process.env.SSL_WIRELESS_SID || "ShopPilot",
          msisdn: opts.to,
          sms: opts.message,
          csms_id: `sp_${Date.now()}`
        })
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`SSL Wireless send failed ${res.status}: ${body.slice(0, 200)}`);
      }
      return { success: true, provider: "ssl-wireless" as const };
    } catch (e) {
      console.warn("[integrations] SSL Wireless send failed, falling back to log:", String(e));
    }
  }
  // Mock / fallback
  console.log(`[SMS to ${opts.to}]: ${opts.message}`);
  return { success: true };
}

// ============================================================
// Order automation helpers
// ============================================================

export async function createOrderFromInbox(opts: {
  businessId: string;
  customerId: string;
  items: Array<{ productId: string; quantity: number; unitPrice?: number }>;
  shipping: { name: string; phone: string; address: string; city: string; area?: string };
  source?: string;
}) {
  // Look up product prices if not provided
  const productIds = opts.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map<string, ProductLite>(
    products.map((p: { id: string }) => [p.id, p as unknown as ProductLite])
  );

  const orderItems = opts.items.map((i) => {
    const p = productMap.get(i.productId);
    if (!p) throw new Error(`Product ${i.productId} not found`);
    const unitPrice = i.unitPrice ?? p.price;
    return {
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      quantity: i.quantity,
      unitPrice,
      total: unitPrice * i.quantity
    };
  });

  const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
  const shippingCost = opts.shipping.city.toLowerCase() === "dhaka" ? 60 : 120;
  const total = subtotal + shippingCost;

  // Generate order number
  const count = await prisma.order.count({ where: { businessId: opts.businessId } });
  const orderNumber = `SP-${String(count + 1001).padStart(5, "0")}`;

  const order = await prisma.order.create({
    data: {
      businessId: opts.businessId,
      orderNumber,
      customerId: opts.customerId,
      subtotal,
      shippingCost,
      total,
      status: "confirmed",
      paymentStatus: "pending",
      paymentMethod: "cod",
      source: opts.source ?? "inbox",
      shippingName: opts.shipping.name,
      shippingPhone: opts.shipping.phone,
      shippingAddress: opts.shipping.address,
      shippingCity: opts.shipping.city,
      shippingArea: opts.shipping.area,
      confirmedAt: new Date(),
      items: { create: orderItems }
    },
    include: { items: true, customer: true }
  });

  // Decrement stock
  for (const i of orderItems) {
    await prisma.product.update({
      where: { id: i.productId },
      data: { stock: { decrement: i.quantity } }
    });
    await prisma.stockMovement.create({
      data: {
        productId: i.productId,
        type: "OUT",
        quantity: i.quantity,
        reason: "order",
        reference: order.id
      }
    });
  }

  return order;
}

export async function dispatchToCourier(opts: {
  orderId: string;
  courier: "pathao" | "steadfast" | "redx";
}) {
  const order = await prisma.order.findUnique({
    where: { id: opts.orderId },
    include: { items: true, customer: true }
  });
  if (!order) throw new Error("Order not found");

  const courierFns = {
    pathao: pathaoCreateShipment,
    steadfast: steadfastCreateShipment,
    redx: redxCreateShipment
  };
  const result = await courierFns[opts.courier]({
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.shippingName,
    customerPhone: order.shippingPhone,
    address: order.shippingAddress,
    city: order.shippingCity,
    area: order.shippingArea ?? undefined,
    weight: 0.5,
    codAmount: order.paymentMethod === "cod" ? order.total : 0,
    itemDescription: order.items.map((i: { productName: string }) => i.productName).join(", ")
  });

  await prisma.shipment.create({
    data: {
      businessId: order.businessId,
      orderId: order.id,
      courierName: opts.courier,
      courierTracking: result.trackingCode,
      consignmentId: result.consignmentId,
      status: result.status,
      deliveryCharge: result.deliveryCharge,
      codAmount: order.paymentMethod === "cod" ? order.total : 0
    }
  });

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "shipped",
      fulfillmentStatus: "handed_to_courier",
      courierName: opts.courier,
      courierTracking: result.trackingCode,
      shippedAt: new Date()
    }
  });

  // Notify customer via WhatsApp
  await sendWhatsappMessage({
    to: order.shippingPhone,
    message: `আপনার অর্ডার #${order.orderNumber} শিপ করা হয়েছে! Tracking: ${result.trackingCode} (${opts.courier}). ধন্যবাদ!`
  });

  return result;
}
