// Bilingual (Bangla + English) translation map for UI.
// All UI strings live here so we can flip language instantly.

export const dict = {
  bn: {
    appName: "ShopPilot AI",
    tagline: "সোশ্যাল কমার্সের AI অপারেটিং সিস্টেম",
    nav: {
      dashboard: "ড্যাশবোর্ড",
      inbox: "ইনবক্স",
      orders: "অর্ডার",
      products: "পণ্য",
      customers: "কাস্টমার",
      resellers: "রিসেলার",
      content: "AI কন্টেন্ট",
      copilot: "AI কোপাইলট",
      settings: "সেটিংস"
    },
    common: {
      save: "সেভ",
      cancel: "বাতিল",
      delete: "মুছুন",
      edit: "এডিট",
      add: "যোগ করুন",
      search: "সার্চ করুন",
      loading: "লোড হচ্ছে...",
      noData: "কোন ডেটা নেই",
      all: "সব",
      active: "সক্রিয়",
      inactive: "নিষ্ক্রিয়",
      yes: "হ্যাঁ",
      no: "না",
      total: "মোট",
      today: "আজ",
      yesterday: "গতকাল",
      thisWeek: "এই সপ্তাহ",
      thisMonth: "এই মাস",
      last7days: "গত ৭ দিন",
      last30days: "গত ৩০ দিন",
      actions: "অ্যাকশন"
    },
    status: {
      new: "নতুন",
      confirmed: "কনফার্মড",
      packed: "প্যাকড",
      shipped: "শিপড",
      delivered: "ডেলিভারড",
      cancelled: "বাতিল",
      returned: "রিটার্নড",
      pending: "পেন্ডিং",
      paid: "পেইড",
      partial: "আংশিক",
      open: "খোলা",
      resolved: "সমাধান",
      snoozed: "স্নুজড"
    },
    payment: {
      cod: "ক্যাশ অন ডেলিভারি",
      bkash: "বিকাশ",
      nagad: "নগদ",
      rocket: "রকেট",
      bank: "ব্যাংক"
    }
  },
  en: {
    appName: "ShopPilot AI",
    tagline: "The AI Operating System for Social Commerce",
    nav: {
      dashboard: "Dashboard",
      inbox: "Inbox",
      orders: "Orders",
      products: "Products",
      customers: "Customers",
      resellers: "Resellers",
      content: "AI Content",
      copilot: "AI Copilot",
      settings: "Settings"
    },
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      add: "Add",
      search: "Search",
      loading: "Loading...",
      noData: "No data",
      all: "All",
      active: "Active",
      inactive: "Inactive",
      yes: "Yes",
      no: "No",
      total: "Total",
      today: "Today",
      yesterday: "Yesterday",
      thisWeek: "This Week",
      thisMonth: "This Month",
      last7days: "Last 7 days",
      last30days: "Last 30 days",
      actions: "Actions"
    },
    status: {
      new: "New",
      confirmed: "Confirmed",
      packed: "Packed",
      shipped: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
      returned: "Returned",
      pending: "Pending",
      paid: "Paid",
      partial: "Partial",
      open: "Open",
      resolved: "Resolved",
      snoozed: "Snoozed"
    },
    payment: {
      cod: "Cash on Delivery",
      bkash: "bKash",
      nagad: "Nagad",
      rocket: "Rocket",
      bank: "Bank"
    }
  }
} as const;

export type Lang = keyof typeof dict;
export type Dict = (typeof dict)["en"];

export function t(lang: Lang): Dict {
  return dict[lang] as Dict;
}
