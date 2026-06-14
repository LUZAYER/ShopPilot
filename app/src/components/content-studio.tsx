"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label, Select } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { generateProductDescription, generateFacebookPost, generateCampaign, translateText } from "@/lib/ai-client";

type Product = { id: string; name: string; category: string | null };

export function ContentStudio({ products }: { products: Product[] }) {
  return (
    <Tabs defaultValue="description">
      <TabsList>
        <TabsTrigger value="description">Product description</TabsTrigger>
        <TabsTrigger value="facebook">Facebook post</TabsTrigger>
        <TabsTrigger value="campaign">Campaign</TabsTrigger>
        <TabsTrigger value="translate">Translate</TabsTrigger>
      </TabsList>
      <TabsContent value="description"><DescriptionTab products={products} /></TabsContent>
      <TabsContent value="facebook"><FacebookTab products={products} /></TabsContent>
      <TabsContent value="campaign"><CampaignTab /></TabsContent>
      <TabsContent value="translate"><TranslateTab /></TabsContent>
    </Tabs>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function useGenerate<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() { setLoading(true); try { setData(await fn()); } finally { setLoading(false); } }
  return { data, loading, run };
}

function DescriptionTab({ products }: { products: Product[] }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [features, setFeatures] = useState("");
  const [tone, setTone] = useState("friendly");
  const gen = useGenerate<{ title: string; body: string; bullets: string[] }>(() =>
    generateProductDescription({ name, category, features, tone })
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Product name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Premium Silk Hijab" />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Fashion / Hijab" />
          </div>
          <div className="space-y-1">
            <Label>Key features</Label>
            <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={3} placeholder="100% silk, soft texture, multiple colors…" />
          </div>
          <div className="space-y-1">
            <Label>Tone</Label>
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="friendly">Friendly</option>
              <option value="luxury">Luxury</option>
              <option value="professional">Professional</option>
              <option value="urgent">Urgent / Sale</option>
            </Select>
          </div>
          <Button onClick={gen.run} disabled={!name || gen.loading} className="w-full">
            {gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Output
            {gen.data && <CopyButton text={`${gen.data.title}\n\n${gen.data.body}\n\n${gen.data.bullets.map(b => `• ${b}`).join("\n")}`} />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!gen.data && <p className="text-sm text-muted-foreground">Output will appear here</p>}
          {gen.data && (
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-base">{gen.data.title}</p>
              <p className="text-gray-700 whitespace-pre-wrap">{gen.data.body}</p>
              <ul className="space-y-1">
                {gen.data.bullets.map((b, i) => <li key={i} className="text-xs text-gray-600">• {b}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FacebookTab({ products }: { products: Product[] }) {
  const [productId, setProductId] = useState("");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("exciting");
  const gen = useGenerate<{ headline: string; body: string; hashtags: string[] }>(() =>
    generateFacebookPost({ productId, topic, tone })
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Product (optional)</Label>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">— none —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Topic / angle</Label>
            <Textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3} placeholder="Eid sale on premium hijabs, free delivery inside Dhaka…" />
          </div>
          <div className="space-y-1">
            <Label>Tone</Label>
            <Select value={tone} onChange={(e) => setTone(e.target.value)}>
              <option value="exciting">Exciting</option>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="testimonial">Testimonial</option>
            </Select>
          </div>
          <Button onClick={gen.run} disabled={!topic || gen.loading} className="w-full">
            {gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate post
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Output
            {gen.data && <CopyButton text={`${gen.data.headline}\n\n${gen.data.body}\n\n${gen.data.hashtags.join(" ")}`} />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!gen.data && <p className="text-sm text-muted-foreground">Output will appear here</p>}
          {gen.data && (
            <div className="space-y-3 text-sm">
              <p className="font-bold text-lg">{gen.data.headline}</p>
              <p className="whitespace-pre-wrap text-gray-700">{gen.data.body}</p>
              <div className="flex flex-wrap gap-1">
                {gen.data.hashtags.map((h, i) => <Badge key={i} variant="secondary" className="text-[10px]">{h}</Badge>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignTab() {
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState(5000);
  const [audience, setAudience] = useState("");
  const gen = useGenerate<{ strategy: string; channels: string[]; steps: string[] }>(() =>
    generateCampaign({ goal, budget, audience })
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Campaign brief</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Goal</Label>
            <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} placeholder="Boost Eid sales by 50%" />
          </div>
          <div className="space-y-1">
            <Label>Budget (BDT)</Label>
            <Input type="number" value={budget} onChange={(e) => setBudget(+e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Audience</Label>
            <Textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={2} placeholder="Women 20-35, Dhaka & Chittagong, fashion interest" />
          </div>
          <Button onClick={gen.run} disabled={!goal || gen.loading} className="w-full">
            {gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Plan campaign
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Output</CardTitle></CardHeader>
        <CardContent>
          {!gen.data && <p className="text-sm text-muted-foreground">Output will appear here</p>}
          {gen.data && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Strategy</p>
                <p className="text-gray-700 whitespace-pre-wrap">{gen.data.strategy}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Channels</p>
                <div className="flex flex-wrap gap-1">
                  {gen.data.channels.map((c, i) => <Badge key={i} variant="outline">{c}</Badge>)}
                </div>
              </div>
              <div>
                <p className="font-semibold mb-1">Action plan</p>
                <ol className="space-y-1 list-decimal list-inside text-gray-700">
                  {gen.data.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TranslateTab() {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<"en" | "bn">("bn");
  const gen = useGenerate<{ translated: string }>(() => translateText(text, target));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Target language</Label>
            <Select value={target} onChange={(e) => setTarget(e.target.value as "en" | "bn")}>
              <option value="bn">Bangla → English</option>
              <option value="en">English → Bangla</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Text</Label>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Type or paste your text…" />
          </div>
          <Button onClick={gen.run} disabled={!text || gen.loading} className="w-full">
            {gen.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Translate
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Output
            {gen.data && <CopyButton text={gen.data.translated} />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!gen.data && <p className="text-sm text-muted-foreground">Translation will appear here</p>}
          {gen.data && <p className="text-sm whitespace-pre-wrap text-gray-700">{gen.data.translated}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
