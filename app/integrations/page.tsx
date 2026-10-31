"use client";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Network,
  Fingerprint,
  Workflow,
  ShieldAlert,
  BellRing,
  FileCheck,
  LockKeyhole,
  Boxes,
  Sun,
  Moon,
  ArrowUpRight,
} from "lucide-react";
import { IntegrationsView } from "@/components/integrations-view";
import { financeDemoLink } from "@/lib/finance-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const steps = [
  { label: "Microservices", icon: Boxes },
  { label: "Identity Discovery", icon: Fingerprint },
  { label: "Security Twin", icon: Network },
  { label: "Trust Graph", icon: Workflow },
  { label: "Permission Analysis", icon: LockKeyhole },
  { label: "Confused-Deputy Detection", icon: ShieldAlert },
  { label: "Risk Alert", icon: BellRing },
  { label: "Recommended Policy Fix", icon: ShieldCheck },
  { label: "Evidence Ledger", icon: FileCheck },
];

export default function ConnectedApplications() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const stored = localStorage.getItem("aegis-theme");
    const timer = setTimeout(
      () => setTheme(stored === "light" ? "light" : "dark"),
      0,
    );
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("aegis-theme", theme);
  }, [theme]);
  return (
    <SidebarProvider defaultOpen>
      <Sidebar
        collapsible="icon"
        className="border-r border-white/8 bg-[#09101a]"
      >
        <SidebarHeader className="border-b border-white/8 px-3 py-4">
          <a href="/deputy-prototype/index.html" className="flex items-center gap-3 px-1">
            <div className="grid size-8 place-items-center rounded-lg bg-[#9af4ce] text-[#07110e]">
              <ShieldCheck className="size-[18px]" />
            </div>
            <div className="group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-semibold tracking-[0.08em] text-white">
                AEGIS
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Confused deputy detector
              </p>
            </div>
          </a>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[10px] tracking-[0.13em] text-slate-500">
              DETECTION FLOW · DEMO
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {steps.map((step, index) => (
                  <SidebarMenuItem key={step.label}>
                    <SidebarMenuButton
                      asChild
                      tooltip={step.label}
                      className="h-10 text-[13px] text-slate-400 hover:bg-white/5 hover:text-white"
                    >
                      <a href={`/deputy-prototype/index.html?stage=${index}`}>
                        <step.icon className="size-4" />
                        <span>{step.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                <SidebarMenuItem className="mt-4">
                  <SidebarMenuButton
                    isActive
                    className="h-10 bg-[#13261f] text-[#b8f8dc]"
                  >
                    <Workflow className="size-4" />
                    <span>Integrations</span>
                    <span className="ml-auto text-[9px]">CONNECT</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/8 p-4 group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] tracking-wider text-slate-500">
            FINANCE APPLICATION
          </p>
          <p className="mt-2 text-xs text-slate-300">Northstar Finance</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Fictional data · monitoring only
          </p>
          <a
            href={financeDemoLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-[#a7f4d3]"
          >
            Open finance demo <ArrowUpRight className="size-3" />
          </a>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-svh bg-[#0b111b]">
        <header className="flex h-16 items-center justify-between border-b border-white/8 px-4 md:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger />
            <span className="text-xs text-slate-400">
              Northstar APIs / Integrations
            </span>
          </div>
          <button
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="inline-flex items-center gap-2 rounded-md border border-white/8 px-3 py-2 text-xs text-slate-400"
          >
            {theme === "dark" ? (
              <Sun className="size-3.5" />
            ) : (
              <Moon className="size-3.5" />
            )}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </header>
        <main className="p-4 md:p-7">
          <IntegrationsView />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
