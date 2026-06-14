/**
 * ShopPilot AI — Demo Seed
 * Creates 1 owner user, 1 business, 10 products, 8 customers,
 * ~12 orders across mixed statuses, conversations, payments,
 * shipments, insights and a few resellers.
 *
 * Demo login:
 *   email: demo@shoppilot.ai
 *   password: demo1234
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const NAMES_BN = ["Fatima", "Ayesha", "Sumaiya", "Tasnim", "Rabeya", "Mahmuda", "Jannat", "Laboni"];
const NAMES_EN = ["Karim", "Rahim", "Hossain", "Akter", "Begum", "Khan", "Rahman", "Mia"];
const CITIES = ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Barishal", "Rangpur", "Gazipur"];

const PRODUCTS = [
  { name: "Three-Piece Suit (Georgette)", nameBn: "থ্রি-পিস স্যুট (জর্জেট)", price: 1850, cost: 950, category: "Clothing", stock: 24, sku: "TS-GRG-001" },
  { name: "Embroidered Kurti", nameBn: "এমব্রয়ডারি কুর্তি", price: 950, cost: 420, category: "Clothing", stock: 38, sku: "KU-EMB-002" },
  { name: "Cotton Panjabi", nameBn: "কটন পাঞ্জাবি", price: 1200, cost: 540, category: "Clothing", stock: 18, sku: "PJ-CTN-003" },
  { name: "Premium Hijab Set", nameBn: "প্রিমিয়াম হিজাব সেট", price: 650, cost: 240, category: "Accessories", stock: 56, sku: "HJ-PRM-004" },
  { name: "Hand-stitched Bindi Collection", nameBn: "হাতের কাজের বিন্দি কালেকশন", price: 480, cost: 180, category: "Accessories", stock: 72, sku: "BN-HND-005" },
  { name: "Organic Lipstick (4-shade)", nameBn: "অর্গানিক লিপস্টিক (৪ শেড)", price: 380, cost: 130, category: "Beauty", stock: 91, sku: "LP-ORG-006" },
  { name: "Kashmiri Almond Oil (100ml)", nameBn: "কাশ্মীরি বাদাম তেল (১০০ মিলি)", price: 720, cost: 310, category: "Beauty", stock: 33, sku: "AO-KSH-007" },
  { name: "Bangladeshi Mango Pickle (500g)", nameBn: "বাংলাদেশি আমের আচার (৫০০ গ্রাম)", price: 320, cost: 110, category: "Food", stock: 47, sku: "MP-BD-008" },
  { name: "Handmade Jewellery Box", nameBn: "হাতে তৈরি গহনার বাক্স", price: 1450, cost: 680, category: "Home", stock: 12, sku: "JB-HND-009" },
  { name: "Aromatic Attar Set (3pcs)", nameBn: "সুগন্ধি আতর সেট (৩টি)", price: 880, cost: 320, category: "Beauty", stock: 26, sku: "AT-ARM-010" }
];

const STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "delivered", "delivered", "cancelled"];
const PAYMENT_STATUSES = ["pending", "paid", "paid", "paid", "paid", "refunded"];
const CHANNELS = ["facebook", "whatsapp", "instagram", "messenger", "website"];
const PAYMENT_METHODS = ["cod", "bkash", "nagad", "rocket", "card"];
const SAMPLE_MESSAGES = [
  "ভাই, এই জামাটা কি সাইজ M আছে?",
  "Delivery কবে পাবো?",
  "Price একটু কমানো যাবে?",
  "আমি ২টা নিতে চাই, কনফার্ম করুন",
  "ধন্যবাদ, অর্ডার করলাম",
  "Can you ship to Sylhet?",
  "bKash payment কিভাবে করবো?",
  "ভাই, একটু ছবি পাঠান"
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  return "01" + Math.floor(700000000 + Math.random() * 299999999);
}

async function main() {
  console.log("🧹 Resetting tables...");
  // Order matters because of FKs
  await db.commission.deleteMany();
  await db.shipment.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.message.deleteMany();
  await db.conversation.deleteMany();
  await db.resellerProduct.deleteMany();
  await db.reseller.deleteMany();
  await db.insight.deleteMany();
  await db.contentPost.deleteMany();
  await db.stockMovement.deleteMany();
  await db.product.deleteMany();
  await db.customer.deleteMany();
  await db.business.deleteMany();
  await db.user.deleteMany();

  console.log("👤 Creating owner user...");
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const owner = await db.user.create({
    data: {
      email: "demo@shoppilot.ai",
      name: "Fatima Rahman",
      phone: "01711000000",
      passwordHash,
      role: "OWNER",
      preferredLang: "bn"
    }
  });

  console.log("🏢 Creating business...");
  const business = await db.business.create({
    data: {
      name: "Fatima's Boutique",
      slug: "fatimas-boutique",
      industry: "fashion",
      city: "Dhaka",
      language: "bn",
      currency: "BDT",
      ownerId: owner.id
    }
  });

  // Reflect business in user for session lookups
  await db.user.update({ where: { id: owner.id }, data: { staffOfId: business.id } });

  console.log("📦 Creating products...");
  const products = [];
  for (const p of PRODUCTS) {
    const created = await db.product.create({
      data: {
        businessId: business.id,
        name: p.name,
        nameBn: p.nameBn,
        description: `Premium quality ${p.name} from Fatima's Boutique.`,
        sku: p.sku,
        price: p.price,
        cost: p.cost,
        costPrice: p.cost,
        stock: p.stock,
        category: p.category,
        status: "active",
        active: true
      }
    });
    products.push(created);
    await db.stockMovement.create({
      data: {
        productId: created.id,
        type: "purchase",
        quantity: p.stock,
        reason: "Initial stock"
      }
    });
  }

  console.log("👥 Creating customers...");
  const customers = [];
  for (let i = 0; i < 8; i++) {
    const c = await db.customer.create({
      data: {
        businessId: business.id,
        name: pick(NAMES_BN) + " " + pick(NAMES_EN),
        phone: randomPhone(),
        whatsappPhone: randomPhone(),
        facebookId: "fb_" + Math.random().toString(36).slice(2, 12),
        city: pick(CITIES),
        address: "House " + (i + 1) + ", Road " + (i + 3) + ", " + pick(CITIES),
        totalSpent: 0,
        language: i % 2 === 0 ? "bn" : "en",
        tags: i % 2 === 0 ? "vip,repeat" : "new"
      }
    });
    customers.push(c);
  }

  console.log("🛒 Creating orders...");
  const orders = [];
  for (let i = 0; i < 14; i++) {
    const customer = pick(customers);
    const itemCount = 1 + Math.floor(Math.random() * 3);
    const items: { productId: string; productName: string; sku: string | null; quantity: number; unitPrice: number; total: number }[] = [];
    let subtotal = 0;
    for (let j = 0; j < itemCount; j++) {
      const p = pick(products);
      const qty = 1 + Math.floor(Math.random() * 2);
      const lineTotal = p.price * qty;
      items.push({
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: qty,
        unitPrice: p.price,
        total: lineTotal
      });
      subtotal += lineTotal;
    }
    const shipping = subtotal > 2000 ? 0 : 80;
    const total = subtotal + shipping;
    const status = pick(STATUSES);
    const paymentStatus = pick(PAYMENT_STATUSES);
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000);

    const order = await db.order.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        orderNumber: `SP-${1000 + i}`,
        status,
        paymentStatus,
        paymentMethod: pick(PAYMENT_METHODS),
        channel: pick(CHANNELS),
        source: pick(CHANNELS),
        subtotal,
        shippingCost: shipping,
        total,
        shippingName: customer.name ?? "Customer",
        shippingPhone: customer.phone ?? "01000000000",
        shippingAddress: customer.address ?? "—",
        shippingCity: customer.city ?? "Dhaka",
        notes: i % 3 === 0 ? "Customer requested gift wrap" : null,
        createdAt,
        paidAt: paymentStatus === "paid" ? createdAt : null,
        items: { create: items }
      }
    });
    orders.push(order);

    // Customer running total
    if (paymentStatus === "paid") {
      await db.customer.update({
        where: { id: customer.id },
        data: { totalSpent: { increment: total } }
      });
    }

    // Payment row
    if (paymentStatus !== "pending") {
      await db.payment.create({
        data: {
          businessId: business.id,
          orderId: order.id,
          amount: total,
          method: order.paymentMethod,
          status: paymentStatus === "paid" ? "success" : "refunded",
          trxId: paymentStatus === "paid" ? "TRX" + Math.random().toString(36).slice(2, 10).toUpperCase() : null
        }
      });
    }

    // Shipment for shipped/delivered
    if (status === "shipped" || status === "delivered") {
      await db.shipment.create({
        data: {
          businessId: business.id,
          orderId: order.id,
          courierName: pick(["Pathao", "Steadfast", "RedX", "Sundarban"]),
          courierTracking: "TRK" + Math.random().toString(36).slice(2, 10).toUpperCase(),
          status: status === "delivered" ? "delivered" : "in_transit",
          deliveryCharge: 60
        }
      });
    }
  }

  console.log("💬 Creating conversations & messages...");
  for (let i = 0; i < 6; i++) {
    const customer = pick(customers);
    const channel = pick(CHANNELS);
    const conv = await db.conversation.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        channel,
        status: i % 4 === 0 ? "open" : "resolved",
        unreadCount: i % 3 === 0 ? Math.floor(Math.random() * 3) + 1 : 0
      }
    });
    // 3-5 messages
    const msgCount = 3 + Math.floor(Math.random() * 3);
    let lastTime = new Date(Date.now() - Math.floor(Math.random() * 5) * 86400000);
    for (let m = 0; m < msgCount; m++) {
      const isInbound = m % 2 === 0;
      lastTime = new Date(lastTime.getTime() + Math.floor(Math.random() * 30 + 5) * 60000);
      await db.message.create({
        data: {
          conversationId: conv.id,
          direction: isInbound ? "inbound" : "outbound",
          senderId: isInbound ? customer.id : owner.id,
          senderType: isInbound ? "customer" : "agent",
          content: pick(SAMPLE_MESSAGES),
          contentBn: null,
          createdAt: lastTime
        }
      });
    }
    await db.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: lastTime }
    });
  }

  console.log("🤝 Creating resellers...");
  for (let i = 0; i < 3; i++) {
    const resellerUser = await db.user.create({
      data: {
        email: `reseller${i + 1}@shoppilot.ai`,
        name: pick(NAMES_BN) + " (Reseller)",
        phone: randomPhone(),
        passwordHash: await bcrypt.hash("reseller123", 10),
        role: "RESELLER",
        staffOfId: business.id,
        preferredLang: "bn"
      }
    });
    await db.reseller.create({
      data: {
        businessId: business.id,
        userId: resellerUser.id,
        name: resellerUser.name!,
        phone: resellerUser.phone!,
        email: resellerUser.email,
        city: pick(CITIES),
        tier: pick(["bronze", "silver", "gold"]),
        status: "active",
        referralCode: "REF" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        commissionType: "percentage",
        commissionValue: 10 + i * 2,
        commissionRate: 10 + i * 2
      }
    });
  }

  console.log("📝 Creating sample content posts...");
  await db.contentPost.create({
    data: {
      businessId: business.id,
      type: "product_description",
      title: "Three-Piece Suit Description",
      prompt: "Write a Bangla description for a Georgette three-piece suit",
      output: "এই জর্জেট থ্রি-পিস স্যুটটি আধুনিক নারীর জন্য একটি নিখুঁত পছন্দ...",
      outputBn: "এই জর্জেট থ্রি-পিস স্যুটটি আধুনিক নারীর জন্য একটি নিখুঁত পছন্দ...",
      status: "published",
      channel: "website"
    }
  });
  await db.contentPost.create({
    data: {
      businessId: business.id,
      type: "facebook_post",
      title: "Weekend Sale Post",
      prompt: "Create a Facebook post for our weekend sale",
      output: "🔥 Weekend Special! 20% off on all kurtis. Order now!",
      outputBn: "🔥 উইকেন্ড স্পেশাল! সব কুর্তিতে ২০% ছাড়। এখনই অর্ডার করুন!",
      status: "published",
      channel: "facebook",
      platform: "facebook"
    }
  });
  await db.contentPost.create({
    data: {
      businessId: business.id,
      type: "campaign",
      title: "Eid Campaign 2025",
      prompt: "Plan an Eid marketing campaign",
      output: "Eid campaign across Facebook + WhatsApp with daily posts and bundle deals...",
      status: "draft",
      channel: "multi"
    }
  });

  console.log("💡 Creating insights...");
  const insights = [
    {
      title: "Stock alert: Lipstick low",
      body: "Organic Lipstick stock is below 50. Reorder soon to avoid lost sales.",
      type: "inventory",
      priority: "high",
      severity: "high"
    },
    {
      title: "bKash payments are 60% of revenue",
      body: "Consider promoting bKash-only weekend deals to lock in cash flow.",
      type: "opportunity",
      priority: "medium",
      severity: "medium"
    },
    {
      title: "Chattogram buyers spend 28% more",
      body: "Customers in Chattogram have higher AOV. Run a city-targeted ad.",
      type: "customer",
      priority: "medium",
      severity: "medium"
    },
    {
      title: "Reseller Fatima (gold) drove 3 orders this week",
      body: "Top reseller is performing — consider a bonus or featured placement.",
      type: "ops",
      priority: "low",
      severity: "low"
    }
  ];
  for (const i of insights) {
    await db.insight.create({
      data: { businessId: business.id, ...i }
    });
  }

  console.log("✅ Seed complete!");
  console.log("   Owner login: demo@shoppilot.ai / demo1234");
  console.log(`   ${products.length} products · ${customers.length} customers · ${orders.length} orders`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
