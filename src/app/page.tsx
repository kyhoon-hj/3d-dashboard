"use client";

import dynamic from "next/dynamic";

// Dynamically import the entire Dashboard with SSR disabled
// to prevent hydration mismatches from real-time log timestamps
const Dashboard = dynamic(() => import("../components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center w-screen h-screen bg-cozy-bg text-cozy-text-light font-mono">
      <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="font-sans font-bold text-sm tracking-wider animate-pulse">
        스마트 홈 시스템 부팅 중...
      </p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="min-h-screen w-screen overflow-hidden bg-cozy-bg">
      <Dashboard />
    </main>
  );
}
