import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Coffee,
  Palette,
  Leaf,
  Camera,
  Music2,
  Sparkles,
  Gift,
  Heart,
  X,
  Star,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { defaultSlug, isDemo } from "../lib/config";
import type { BoothIcon } from "../types";

export const icons = {
  coffee: Coffee,
  palette: Palette,
  leaf: Leaf,
  camera: Camera,
  music: Music2,
  sparkles: Sparkles,
  gift: Gift,
  heart: Heart,
};
export function BoothSymbol({
  icon,
  size = 30,
}: {
  icon: BoothIcon;
  size?: number;
}) {
  const Icon = icons[icon] || Sparkles;
  return <Icon size={size} strokeWidth={1.7} />;
}
export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  return (
    <>
      {isDemo && (
        <div className="demo-banner no-print">
          <span className="demo-dot" /> 체험 모드{" "}
          <span className="demo-detail">· 기록은 이 브라우저에만 저장돼요</span>
          <Link to="/admin">
            운영자 체험 <ArrowUpRight size={12} />
          </Link>
        </div>
      )}
      <header className="site-header no-print">
        <div className="header-inner">
          <Link className="brand" to={`/e/${defaultSlug}`} aria-label="모아 홈">
            <span className="brand-icon">
              <Star size={19} fill="currentColor" />
            </span>
            모아<span className="brand-description">STAMP TOUR</span>
          </Link>
          <nav aria-label="메인 메뉴">
            <Link
              className={!isAdmin ? "nav-active" : ""}
              to={`/e/${defaultSlug}`}
            >
              나의 스탬프
            </Link>
            <Link className={isAdmin ? "nav-active" : ""} to="/admin">
              운영자<span className="desktop-only"> 페이지</span>
              <ArrowUpRight size={14} />
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="site-footer no-print">
        <Link to={`/e/${defaultSlug}`} className="footer-brand">
          모아<span>작은 경험이 모여, 특별한 하루.</span>
        </Link>
        <span>Made for your little discoveries.</span>
      </footer>
    </>
  );
}
export function Loading({ text = "잠시만 기다려 주세요" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={28} />
      <p>{text}</p>
    </div>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={19} />
      <span>{message}</span>
      {retry && (
        <button className="text-button" onClick={retry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current!;
    node.showModal();
    return () => node.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-body">
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <div className="success-notice" role="status">
      <Check size={18} />
      {children}
    </div>
  );
}
