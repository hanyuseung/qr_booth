import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Shared";
import { TourPage } from "./pages/TourPage";
import { ScanPage } from "./pages/ScanPage";
import { AdminPage } from "./pages/AdminPage";
import { PrintPage } from "./pages/PrintPage";
import { defaultSlug } from "./lib/config";
import "./styles.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="page-shell empty-state">
        <h1>화면을 불러오지 못했어요</h1>
        <p>브라우저 저장 공간을 사용할 수 있는지 확인하고 다시 열어주세요.</p>
        <button
          className="button button-primary"
          onClick={() => window.location.reload()}
        >
          다시 불러오기
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route
              path="/"
              element={<Navigate to={`/e/${defaultSlug}`} replace />}
            />
            <Route path="/e/:slug" element={<TourPage />} />
            <Route path="/e/:slug/scan/:token" element={<ScanPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/print/:slug" element={<PrintPage />} />
            <Route
              path="*"
              element={
                <main className="page-shell empty-state">
                  <h1>페이지를 찾을 수 없어요</h1>
                  <Link to="/">스탬프북으로 돌아가기</Link>
                </main>
              }
            />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
