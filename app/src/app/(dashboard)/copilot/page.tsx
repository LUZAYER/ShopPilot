import { requireBusiness } from "@/lib/session";
import { CopilotChat } from "@/components/copilot-chat";

export default async function CopilotPage() {
  await requireBusiness();

  const suggestions = [
    "কোন পণ্য সবচেয়ে বেশি বিক্রি হচ্ছে গত ৭ দিনে?",
    "Which products are low in stock?",
    "What was my revenue last week?",
    "মাসের শেষে কত আয় হবে বর্তমান গতিতে?",
    "Show me my top 5 customers",
    "How can I reduce cancellations?"
  ];

  return (
    <div className="space-y-6 h-[calc(100vh-7rem)] flex flex-col">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Copilot</h1>
        <p className="text-sm text-muted-foreground">
          আপনার ব্যবসা সম্পর্কে যেকোন প্রশ্ন করুন — Bangla বা English
        </p>
      </div>

      <CopilotChat suggestions={suggestions} />
    </div>
  );
}
