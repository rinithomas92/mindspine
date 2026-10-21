"use client";
import { useEffect, useRef, useId, useState } from "react";
import { X, ArrowUpRight, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
export function Modal({ title, subtitle, children, onClose, className = "", }: {
    title: React.ReactNode;
    subtitle?: string;
    children: React.ReactNode;
    onClose: () => void;
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const el = ref.current;
        el?.showModal();
        return () => el?.close();
    }, []);
    return (<dialog className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} onCancel={(e) => {
            e.preventDefault();
            onClose();
        }} onClick={(e) => {
            if (e.target === e.currentTarget)
                onClose();
        }}>
      <div className="modal-top">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X size={21}/>
        </button>
      </div>
      {children}
    </dialog>);
}
export function Badge({ children, tone = "", }: {
    children: React.ReactNode;
    tone?: string;
}) {
    return <span className={"badge " + tone}>{children}</span>;
}
export function Avatar({ name, size = "", avatar = "" }: {
    name: string;
    size?: string;
    avatar?: string;
}) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [avatar]);
    if (avatar && !failed)
        return <img className={"avatar " + size} src={avatar} alt="" onError={() => setFailed(true)} />;
    return (<span className={"avatar " + size}>
      {name
            .replace(/^Dr\. /, "")
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
    </span>);
}
export function Empty({ title, description, action, icon: Icon = Inbox, }: {
    title: string;
    description: string;
    action?: React.ReactNode;
    icon?: LucideIcon;
}) {
    return (<div className="empty">
      <Icon size={30} aria-hidden="true"/>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>);
}
export function SectionHead({ title, description, action, onClick, }: {
    title: string;
    description?: string;
    action?: string;
    onClick?: () => void;
}) {
    return (<div className="section-head">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && (<button className="text-button" onClick={onClick}>
          {action}
          <ArrowUpRight size={15}/>
        </button>)}
    </div>);
}
export const money = (amount: number) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
}).format(amount / 100);
export const date = (value: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }) => new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    ...options,
}).format(new Date(value.endsWith("Z") || value.includes("+")
    ? value
    : value.replace(" ", "T") + "Z"));
export const time = (value: string) => date(value, { hour: "numeric", minute: "2-digit" });
export const dayKey = (value: string) => date(value, { year: "numeric", month: "2-digit", day: "2-digit" });
