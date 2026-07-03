"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface LegalEntity {
  id: string;
  name: string;
  licenceType: string;
}

const NAV_ITEMS = [
  {
    name: "Dashboard",
    path: "/",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
      </svg>
    ),
  },
  {
    name: "Register Cockpit",
    path: "/register",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Contracts Ingestion",
    path: "/contracts",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: "Remediation Board",
    path: "/remediation",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: "Export Center",
    path: "/exports",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
  {
    name: "Board Packs",
    path: "/exports/board-packs",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-6m4 6V7m4 10v-4M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H7.5L5 5.5V19a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Audit Trail",
    path: "/audit-logs",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: "Exit Plans",
    path: "/exit-plans",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  {
    name: "Incident Logs",
    path: "/incidents",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    name: "Resilience Hub",
    path: "/resilience",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    name: "Annual Reviews",
    path: "/annual-reviews",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Vendor Drafts",
    path: "/outreach",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Policy Settings",
    path: "/settings",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: "Integrations Hub",
    path: "/integrations",
    icon: (
      <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-1a6 6 0 016-6zM16 7a1 1 0 011-1h1v-1a1 1 0 112 0v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 01-1-1z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const selectedEntity = searchParams?.get("entity") || "all";

  useEffect(() => {
    fetch("/api/legal-entities")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEntities(data.entities);
        }
      })
      .catch((err) => console.error("Failed to fetch legal entities in sidebar:", err));
  }, []);

  const handleEntityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const params = new URLSearchParams(window.location.search);
    if (value === "all") {
      params.delete("entity");
    } else {
      params.set("entity", value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <aside className="sidebar">
      <div className="logo-container" style={{ borderBottom: "none", paddingBottom: 0 }}>
        <div className="logo-icon">D</div>
        <div className="logo-text">DORA Workbench</div>
      </div>

      <div style={{ padding: "0.5rem 1rem 1rem 1rem", borderBottom: "1px solid var(--border-color)" }}>
        <label style={{ display: "block", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem", fontWeight: 600 }}>
          Consolidation Context
        </label>
        <select
          value={selectedEntity}
          onChange={handleEntityChange}
          style={{
            width: "100%",
            backgroundColor: "rgba(10, 12, 18, 0.6)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            padding: "0.4rem 0.5rem",
            fontSize: "0.75rem",
            fontWeight: 500,
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="all">🏢 Consolidated Group View</option>
          {entities.map((ent) => (
            <option key={ent.id} value={ent.id}>
              🛡️ {ent.name} ({ent.licenceType})
            </option>
          ))}
        </select>
      </div>

      <nav style={{ flex: 1, marginTop: "0.5rem" }}>
        <ul className="nav-links">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.path ||
              (item.path !== "/" && pathname?.startsWith(item.path));
            return (
              <li key={item.name}>
                <Link
                  href={item.path}
                  className={`nav-link ${isActive ? "active" : ""}`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div style={{ padding: "1rem", borderTop: "1px solid var(--border-color)", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span>Regulatory Anchor</span>
        <span style={{ color: "var(--color-brand)", fontWeight: 600 }}>DORA Jan 17, 2025</span>
        <span style={{ fontSize: "0.7rem" }}>Wedge Focus: DE / Germany</span>
      </div>
    </aside>
  );
}
