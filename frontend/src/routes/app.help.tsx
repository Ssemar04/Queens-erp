import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, HelpCircle, BookOpen, MessageSquare, Mail, Keyboard, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ_DATA } from "@/lib/faq-data";
import { motion } from "framer-motion";

export const Route = createFileRoute("/app/help")({
  component: HelpPage,
  head: () => ({ meta: [{ title: "Help center · Queenstech ERP" }] }),
});

function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return FAQ_DATA
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => {
          if (!q) return true;
          return item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q);
        }),
      }))
      .filter((cat) => cat.items.length > 0)
      .filter((cat) => !activeCat || cat.title === activeCat);
  }, [search, activeCat]);

  const totalResults = filtered.reduce((sum, cat) => sum + cat.items.length, 0);
  const totalAll = FAQ_DATA.reduce((s, c) => s + c.items.length, 0);

  const sectionIndex = (key: string) => Math.max(0, ["hero"].indexOf(key));

  return (
    <div className="w-full min-w-0 space-y-6">
      <motion.section
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.02 * sectionIndex("hero"), duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#003399]/15 bg-gradient-to-br from-[#003399] via-[#003399] to-[#004CCC] text-white p-6 shadow-[0_10px_40px_-18px_rgba(0,51,153,0.45)]"
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-24 -bottom-28 h-72 w-72 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute right-6 top-1/2 hidden md:block -translate-y-1/2 pointer-events-none">
          <div className="relative">
            <div className="h-20 w-20 rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.06)] -rotate-3">
              <HelpCircle className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -bottom-2 -right-3 h-8 w-8 rounded-xl bg-cyan-400/90 text-[#111] flex items-center justify-center shadow-lg">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="relative flex items-start gap-4">
          <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <HelpCircle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium ring-1 ring-white/15 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Help center
            </div>
            <h1 className="text-2xl font-bold leading-tight md:text-[28px]">
              {totalAll} answers across {FAQ_DATA.length} topics
            </h1>
            <p className="max-w-2xl text-sm text-white/80 leading-relaxed">
              Everything you need to run Queenstech ERP like a pro — from first login to advanced financial close.
            </p>
          </div>
        </div>
        <div className="relative mt-5">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search e.g. VAT, reconcile, debtor, asset, request…"
            className="h-11 pl-9 bg-white text-foreground placeholder:text-muted-foreground/70 ring-1 ring-white/20 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.25)]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </motion.section>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickCard icon={BookOpen} title="Getting started" desc="Walk through roles and navigation" onClick={() => setActiveCat("Getting started")} />
        <QuickCard icon={Sparkles} title="What's new" desc="UGX everywhere, unified expenses, new reports" />
        <QuickCard icon={Keyboard} title="Keyboard shortcuts" desc="Press ⌘/Ctrl + K for the command palette" />
        <QuickCard icon={MessageSquare} title="In-app chat" desc="Ping a teammate from the Chat module" link="/app/chat" />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        <Chip active={activeCat === null} onClick={() => setActiveCat(null)}>All topics</Chip>
        {FAQ_DATA.map((cat) => (
          <Chip key={cat.title} active={activeCat === cat.title} onClick={() => setActiveCat(cat.title)}>
            {cat.title}
            <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{cat.items.length}</Badge>
          </Chip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-white py-16 text-center">
          <p className="text-sm text-muted-foreground">No matching questions for "{search}"</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((category) => (
            <div key={category.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category.title}</h2>
              <Accordion type="multiple" className="rounded-xl border border-border bg-white">
                {category.items.map((item, i) => (
                  <AccordionItem key={i} value={`${category.title}-${i}`} className="border-border">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium text-foreground hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
          {(search || activeCat) && (
            <p className="text-center text-xs text-muted-foreground">
              {totalResults} result{totalResults !== 1 ? "s" : ""} {activeCat ? `in ${activeCat}` : "found"}
            </p>
          )}
        </div>
      )}

      {/* Contact strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Still need a hand?</p>
            <p className="text-xs text-muted-foreground">Reach the Queenstech ERP support crew · we usually reply within an hour during business hours.</p>
          </div>
        </div>
        <a
          href="mailto:support@Queenstech ERP.app"
          className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Email support
        </a>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-white text-foreground hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      {children}
    </button>
  );
}

function QuickCard({
  icon: Icon,
  title,
  desc,
  onClick,
  link,
}: {
  icon: typeof BookOpen;
  title: string;
  desc: string;
  onClick?: () => void;
  link?: "/app/chat";
}) {
  const body = (
    <div className="group flex h-full cursor-pointer items-start gap-3 rounded-xl border border-border bg-white p-4 transition hover:border-primary/40 hover:shadow-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
  if (link) return <Link to={link}>{body}</Link>;
  return <button onClick={onClick} className="text-left">{body}</button>;
}
