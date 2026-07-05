"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { observer } from "mobx-react-lite";
import {
  Lightbulb, 
  Coffee, 
  Wind, 
  Trash2, 
  Smile, 
  Heart, 
  Home, 
  Thermometer, 
  Droplets, 
  Zap, 
  Power, 
  RotateCcw,
  Sliders,
  Sparkles,
  Mic,
  Music,
  Tv,
  HelpCircle
} from "lucide-react";
import { dashboardStore } from "../store/dashboardStore";
import { listenWithBrowserSpeech, recordAndTranscribe } from "../lib/sttClient";
import { playTts, playTtsAfterUserGesture } from "../lib/ttsClient";

// Dynamically import ThreeScene to avoid SSR errors
const ThreeScene = dynamic(() => import("./ThreeScene"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col items-center justify-center w-full h-full bg-cozy-bg text-cozy-text-light font-mono animate-pulse">
      <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="font-sans font-bold text-sm tracking-wider">
        3D 스마트 홈 환경 구성 중...
      </p>
    </div>
  ),
});

const getThemeColors = (theme: string) => {
  switch (theme) {
    case "sage":
      return { primary: "#6f9c7a", secondary: "#f0f5f1", accent: "#a2c4ab" };
    case "lavender":
      return { primary: "#8d7fad", secondary: "#f4f2f8", accent: "#b8acd8" };
    default: // apricot
      return { primary: "#e97a47", secondary: "#fef0e9", accent: "#ffb494" };
  }
};

const Dashboard = observer(() => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [isListening, setIsListening] = useState(false);
  const [isBrowserListening, setIsBrowserListening] = useState(false);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const dashboardScale = useMemo(() => {
    const baseWidth = 1280;
    const baseHeight = 720;

    return Math.min(1, viewport.width / baseWidth, viewport.height / baseHeight);
  }, [viewport.height, viewport.width]);

  const scaledDashboardStyle = useMemo<React.CSSProperties>(() => {
    if (dashboardScale >= 1) {
      return {
        height: "100%",
        width: "100%",
      };
    }

    return {
      height: `${viewport.height / dashboardScale}px`,
      transform: `scale(${dashboardScale})`,
      transformOrigin: "top left",
      width: `${viewport.width / dashboardScale}px`,
    };
  }, [dashboardScale, viewport.height, viewport.width]);

  // Auto-scroll logs to top on update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [dashboardStore.logs.length]);

  const selectedNode = dashboardStore.nodes.find(
    (n) => n.id === dashboardStore.selectedNodeId
  );
  const selectionSpeechText =
    selectedNode?.type === "lighting"
      ? "조명이 켜졌습니다"
      : selectedNode?.type === "coffee"
        ? "커피가 준배되었습니다"
        : null;

  useEffect(() => {
    if (!selectionSpeechText) return;

    void playTts(selectionSpeechText).catch((error) => {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        playTtsAfterUserGesture(selectionSpeechText);
        return;
      }

      console.error("Selection TTS playback failed:", error);
    });
  }, [selectedNode?.id, selectionSpeechText]);

  // Theme styling helpers based on active MobX theme
  const getThemeTextClass = () => {
    switch (dashboardStore.themeColor) {
      case "sage":
        return "text-emerald-700 font-black";
      case "lavender":
        return "text-indigo-750 font-black";
      default: // apricot
        return "text-orange-700 font-black";
    }
  };

  const getThemeBgClass = () => {
    switch (dashboardStore.themeColor) {
      case "sage":
        return "bg-sage-secondary border-sage-primary/45";
      case "lavender":
        return "bg-lavender-secondary border-lavender-primary/45";
      default: // apricot
        return "bg-apricot-secondary border-apricot-primary/45";
    }
  };

  const getThemeButtonClass = (color: string) => {
    const isActive = dashboardStore.themeColor === color;
    if (color === "apricot") {
      return isActive 
        ? "bg-orange-500 text-white shadow-md border-orange-500 font-bold" 
        : "bg-white border-cozy-border text-cozy-text hover:bg-orange-50 hover:text-orange-600";
    }
    if (color === "sage") {
      return isActive 
        ? "bg-emerald-600 text-white shadow-md border-emerald-600 font-bold" 
        : "bg-white border-cozy-border text-cozy-text hover:bg-emerald-50 hover:text-emerald-600";
    }
    if (color === "lavender") {
      return isActive 
        ? "bg-indigo-600 text-white shadow-md border-indigo-600 font-bold" 
        : "bg-white border-cozy-border text-cozy-text hover:bg-indigo-50 hover:text-indigo-600";
    }
    return "";
  };

  // Icon resolver based on node type
  const getDeviceIcon = (type: string, size = 18) => {
    switch (type) {
      case "robot":
        return <Smile size={size} />;
      case "lighting":
        return <Lightbulb size={size} />;
      case "coffee":
        return <Coffee size={size} />;
      case "purifier":
        return <Wind size={size} />;
      default:
        return <Trash2 size={size} />;
    }
  };

  const handleTestDevice = (nodeId: string) => {
    const node = dashboardStore.nodes.find((n) => n.id === nodeId);
    if (node) {
      if (node.status === "offline") {
        dashboardStore.addLog(`신호 전송 실패: [${node.name}] 기기 전원이 꺼져 있습니다.`, "error");
      } else {
        dashboardStore.addLog(`기기 신호 정상: [${node.name}]이(가) 정상 응답을 보냈습니다.`, "success");
      }
    }
  };

  const getRobotStatusLabel = () => {
    switch (dashboardStore.robotAnimation) {
      case "Wave":
        return "인사하는 중 👋";
      case "Dance":
        return "신나게 춤추는 중 🎵";
      case "Jump":
        return "도약 점프 중 🚀";
      case "ThumbsUp":
        return "엄지척 칭찬 중 👍";
      case "Yes":
        return "긍정 끄덕임 중 Yes";
      case "No":
        return "부정 도리도리 중 No";
      case "Punch":
        return "가벼운 잽 훈련 중 🥊";
      case "Idle":
        return "대기 상태 (관찰 중) 👁️";
      default:
        return "동작 로딩 중...";
    }
  };

  const handleVoiceCommand = async () => {
    if (isListening) return;

    setIsListening(true);
    dashboardStore.addLog("음성 명령을 듣고 있습니다. 3초 안에 말씀해 주세요.", "info");

    try {
      const transcript = await recordAndTranscribe(3500);
      dashboardStore.handleVoiceCommand(transcript);
    } catch (error) {
      console.error("Voice command failed:", error);
      dashboardStore.addLog("음성 인식에 실패했습니다. 마이크 권한과 네트워크 상태를 확인해 주세요.", "error");
      dashboardStore.triggerRobotGesture("No", "RoBo가 음성 인식 실패를 감지했습니다.");
    } finally {
      setIsListening(false);
    }
  };

  const handleBrowserVoiceCommand = async () => {
    if (isBrowserListening) return;

    setIsBrowserListening(true);
    dashboardStore.addLog("브라우저 무료 음성 인식을 시작합니다. 말씀해 주세요.", "info");

    try {
      const transcript = await listenWithBrowserSpeech(4500);
      dashboardStore.handleVoiceCommand(transcript);
    } catch (error) {
      console.error("Browser voice command failed:", error);
      dashboardStore.addLog("브라우저 음성 인식에 실패했습니다. Chrome/Edge와 마이크 권한을 확인해 주세요.", "error");
      dashboardStore.triggerRobotGesture("No", "RoBo가 브라우저 음성 인식 실패를 감지했습니다.");
    } finally {
      setIsBrowserListening(false);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-cozy-bg cozy-dots">
      <div style={scaledDashboardStyle}>
        <div className="relative flex flex-col w-full h-full overflow-hidden text-cozy-text font-sans select-none">
      
      {/* Soft Header */}
      <header className="relative z-10 flex flex-row items-center justify-between px-6 py-4 border-b border-cozy-border cozy-panel rounded-b-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/60 rounded-2xl border border-white/80 shadow-xs">
            <span className="text-2xl">🤖</span>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-cozy-text flex items-center gap-1.5">
              비서 로봇 RoBo & 스마트홈 <span className={`text-xs px-2 py-0.5 rounded-full bg-white border border-cozy-border ${getThemeTextClass()}`}>HJ Solution HUB v1.3</span>
            </h1>
            <p className="text-[10px] text-cozy-text-light font-bold tracking-wider uppercase font-mono">
              Warm & Cozy Interactive Robot Dashboard
            </p>
          </div>
        </div>

        {/* Global Statistics Panel */}
        <div className="flex items-center gap-4">
          
          {/* Comfort Gauge */}
          <div className="flex items-center gap-2.5 px-4 py-1.5 bg-cozy-card rounded-2xl border border-white/65 shadow-xs">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-100 animate-pulse-slow" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-cozy-text-light font-bold">우리집 쾌적도</span>
              <span className="font-bold text-xs text-cozy-text">
                {dashboardStore.metrics.comfortScore}%
              </span>
            </div>
          </div>

          {/* Temperature */}
          <div className="flex items-center gap-2.5 px-4 py-1.5 bg-cozy-card rounded-2xl border border-white/65 shadow-xs">
            <Thermometer className="w-4 h-4 text-orange-500" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-cozy-text-light font-bold">실내 온도</span>
              <span className="font-bold text-xs text-cozy-text">{dashboardStore.metrics.temperature}℃</span>
            </div>
          </div>

          {/* Theme selection panel */}
          <div className="flex items-center gap-1 bg-cozy-text/5 p-1 border border-cozy-border rounded-2xl">
            <button 
              onClick={() => dashboardStore.setThemeColor("apricot")}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all border border-transparent cursor-pointer ${getThemeButtonClass("apricot")}`}
            >
              살구색
            </button>
            <button 
              onClick={() => dashboardStore.setThemeColor("sage")}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all border border-transparent cursor-pointer ${getThemeButtonClass("sage")}`}
            >
              세이지
            </button>
            <button 
              onClick={() => dashboardStore.setThemeColor("lavender")}
              className={`px-3 py-1.5 text-[10px] font-bold rounded-xl transition-all border border-transparent cursor-pointer ${getThemeButtonClass("lavender")}`}
            >
              라벤더
            </button>
          </div>

          {/* Camera View Reset Button */}
          <button
            onClick={() => dashboardStore.resetView()}
            className="flex items-center gap-1 px-3 py-2 text-[10px] font-bold rounded-xl border border-cozy-border text-cozy-text bg-white hover:bg-apricot-secondary/40 hover:text-cozy-text transition-all shadow-xs shrink-0 cursor-pointer"
            title="카메라 구도 및 캐릭터 회전 상태를 최초 구도로 복귀시킵니다."
          >
            <RotateCcw size={10} /> 뷰 초기화
          </button>

        </div>
      </header>

      {/* Main Board Viewport */}
      <main className="relative flex flex-1 flex-row w-full overflow-hidden">
        
        {/* Left Control Panel */}
        <section className="relative z-10 w-[360px] shrink-0 border-r border-cozy-border cozy-panel flex flex-col overflow-y-auto max-h-full">
          
          {/* Subsection 1: Environment indicators */}
          <div className="p-5 border-b border-white/30">
            <h2 className="text-xs font-bold tracking-wider text-cozy-text mb-4 flex items-center gap-1.5">
              <Home size={14} className={getThemeTextClass()} /> 실내 환경 정보
            </h2>
            
            <div className="space-y-3.5">
              {/* Comfort Score bar */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-cozy-text flex items-center gap-1 font-semibold"><Heart size={12} /> 실내 종합 쾌적지수</span>
                  <span className="text-cozy-text font-bold">{dashboardStore.metrics.comfortScore}%</span>
                </div>
                <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden border border-white/60">
                  <div 
                    className="h-full transition-all duration-500 rounded-full" 
                    style={{ 
                      width: `${dashboardStore.metrics.comfortScore}%`,
                      backgroundColor: dashboardStore.themeColor === "sage" ? "#10b981" : dashboardStore.themeColor === "lavender" ? "#6366f1" : "#f97316"
                    }}
                  />
                </div>
              </div>

              {/* Humidity bar */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-cozy-text flex items-center gap-1 font-semibold"><Droplets size={12} /> 실내 적정 습도</span>
                  <span className="text-cozy-text font-bold">{dashboardStore.metrics.humidity}%</span>
                </div>
                <div className="h-2 w-full bg-white/50 rounded-full overflow-hidden border border-white/60">
                  <div 
                    className="h-full bg-sky-500 transition-all duration-500 rounded-full" 
                    style={{ width: `${dashboardStore.metrics.humidity}%` }}
                  />
                </div>
              </div>

              {/* Energy Usage Info */}
              <div className="flex items-center justify-between p-2.5 bg-white/60 border border-white/70 rounded-2xl text-[11px] shadow-xs">
                <span className="text-cozy-text flex items-center gap-1 font-semibold"><Zap size={12} /> 현재 실시간 전력 소모</span>
                <span className="text-orange-600 font-bold text-sm font-mono">{dashboardStore.metrics.energyUsage} Watts</span>
              </div>
            </div>
          </div>

          {/* Subsection 2: Appliance Switch board */}
          <div className="p-5 flex-1 flex flex-col min-h-0">
            <h2 className="text-xs font-bold tracking-wider text-cozy-text mb-4 flex items-center gap-1.5">
              <Sliders size={14} className={getThemeTextClass()} /> 스마트 가전 스위치
            </h2>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {dashboardStore.nodes.map((node) => {
                const isSelected = dashboardStore.selectedNodeId === node.id;
                
                let statusColor = "bg-emerald-500";
                if (node.status === "warning") statusColor = "bg-amber-400";
                else if (node.status === "offline") statusColor = "bg-rose-400";
                
                return (
                  <div 
                    key={node.id}
                    onClick={() => dashboardStore.selectNode(node.id)}
                    className={`p-3 rounded-2xl border cozy-card-interactive cursor-pointer ${
                      isSelected 
                        ? `${getThemeBgClass()} border-opacity-100 shadow-sm animate-pulse-slow` 
                        : "border-white/40 bg-cozy-card/65 hover:bg-cozy-card hover:border-white/95"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Status color indicator */}
                        <span className={`w-2 h-2 rounded-full ${statusColor} shrink-0`} />
                        
                        {/* Device Icon */}
                        <span className="text-cozy-text-light shrink-0">
                          {getDeviceIcon(node.type, 14)}
                        </span>
                        <span className="text-xs font-bold text-cozy-text truncate">
                          {node.name}
                        </span>
                      </div>

                      {/* On/Off Switch Button */}
                      {node.type !== "robot" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dashboardStore.toggleNodeStatus(node.id);
                          }}
                          className={`p-1.5 border rounded-xl transition-all cursor-pointer ${
                            node.status === "offline"
                              ? "border-rose-200 text-rose-500 bg-rose-50 hover:bg-rose-100 hover:border-rose-400"
                              : "border-cozy-border text-cozy-text-light hover:bg-apricot-secondary hover:text-cozy-text"
                          }`}
                          title={node.status === "offline" ? "전원 켜기" : "전원 끄기"}
                        >
                          <Power size={11} />
                        </button>
                      )}
                    </div>

                    {/* Secondary details */}
                    <div className="flex justify-between items-center text-[10px] mt-2.5 text-cozy-text-light font-bold">
                      <span>{node.location}</span>
                      <span>
                        {node.type === "robot" 
                          ? `배터리: ${node.metric}%` 
                          : node.type === "lighting" 
                            ? `밝기: ${node.metric}%` 
                            : node.type === "coffee" 
                              ? `물탱크: ${node.metric}%` 
                              : node.type === "purifier" 
                                ? `미세먼지: ${node.metric} μg` 
                                : `먼지통: ${node.metric}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Center Section: WebGL 3D Canvas */}
        <section className="relative flex-1 h-full min-h-0 bg-cozy-bg border-cozy-border">
          <ThreeScene />

          {/* Quick manual hints */}
          <div className="absolute bottom-5 left-5 right-5 pointer-events-none z-10 flex justify-center">
            <div className="px-4 py-2 border border-cozy-border bg-white/95 backdrop-blur rounded-2xl text-[10px] font-bold text-cozy-text shadow-xs text-center">
              🖱️ 마우스 드래그로 화면 회전 | 휠 스크롤로 확대/축소 | 로보 및 주변 가전을 클릭하여 명령 내리기
            </div>
          </div>
        </section>

        {/* Right Panel: Smart home inspector & Robot motion controls */}
        <section className="relative z-10 w-[320px] shrink-0 border-l border-cozy-border cozy-panel flex flex-col overflow-y-auto max-h-full">
          
          {/* Subsection 1: Inspector Info Cards */}
          <div className="p-5 border-b border-white/20 flex-1">
            <h2 className="text-xs font-bold tracking-wider text-cozy-text mb-4 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smile size={14} className={getThemeTextClass()} /> 스마트 인스펙터
              </span>
              {selectedNode && (
                <button
                  onClick={() => dashboardStore.selectNode(null)}
                  className="text-[10px] text-cozy-text-light hover:text-cozy-text flex items-center gap-1 border border-cozy-border px-2 py-0.5 rounded-lg bg-white shadow-xs cursor-pointer animate-pulse-slow"
                >
                  <RotateCcw size={10} /> 오버뷰
                </button>
              )}
            </h2>

            {selectedNode ? (
              <div className="space-y-4">
                
                {/* Device Spec Identity card */}
                <div className={`p-4 border rounded-2xl ${getThemeBgClass()} border-white/30 flex items-center gap-3 shadow-sm`}>
                  <div className="p-2.5 bg-white rounded-xl shadow-xs shrink-0 animate-bounce-slow" style={{ color: getThemeColors(dashboardStore.themeColor).primary }}>
                    {getDeviceIcon(selectedNode.type, 18)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-cozy-text truncate">
                      {selectedNode.name}
                    </div>
                    <div className="text-[9px] text-cozy-text-light font-bold uppercase tracking-wider mt-0.5">
                      위치: {selectedNode.location}
                    </div>
                  </div>
                </div>

                {selectedNode.type === "lighting" && (
                  <div className="p-3 border border-amber-200 bg-amber-50/80 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2 shadow-xs">
                    <Lightbulb size={14} className="text-amber-500 fill-amber-200 shrink-0" />
                    <span>조명이 켜졌습니다</span>
                  </div>
                )}

                {/* Description */}
                <div>
                  <h3 className="text-[10px] font-bold text-cozy-text-light uppercase tracking-widest mb-1.5 font-mono">상세 설명</h3>
                  <p className="text-xs text-cozy-text leading-relaxed font-normal">
                    {selectedNode.description}
                  </p>
                </div>

                {/* Interactive control buttons */}
                {selectedNode.type === "robot" ? (
                  // Custom Humanoid Robot Motion Trigger Panel
                  <div className="p-4 border border-amber-300 bg-amber-50/50 rounded-2xl space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      <Sparkles size={12} className="text-amber-500 fill-amber-400" /> RoBo 행동 모션 제어
                    </h4>
                    
                    {/* Robot state monitor */}
                    <div className="flex flex-col gap-1 text-[11px] text-amber-800 bg-white/70 p-2.5 rounded-xl border border-amber-200">
                      <div className="flex justify-between font-bold">
                        <span>현재 동작 상태</span>
                        <span className="text-amber-900">{getRobotStatusLabel()}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {/* Wave Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("Wave", "RoBo: '안녕하세요! 좋은 하루입니다!' (반갑게 손 흔들기)")}
                        className="py-2 px-2 border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                      >
                        👋 반갑게 인사
                      </button>
                      {/* ThumbsUp Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("ThumbsUp", "RoBo: '최고입니다! 응원할게요!' (엄지 척 제스처)")}
                        className="py-2 px-2 border border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                      >
                        👍 엄지척 칭찬
                      </button>
                      {/* Yes Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("Yes", "RoBo: '네! 알겠습니다.' (끄덕끄덕 동의)")}
                        className="py-2 px-2 border border-cozy-border text-cozy-text bg-white hover:bg-apricot-secondary rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                      >
                        🙆 끄덕끄덕
                      </button>
                      {/* No Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("No", "RoBo: '그건 조금 어려울 것 같아요.' (도리도리 거절)")}
                        className="py-2 px-2 border border-cozy-border text-cozy-text bg-white hover:bg-apricot-secondary rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                      >
                        🙅 도리도리
                      </button>
                      {/* Jump Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("Jump", "RoBo: '얍! 날아올라 볼까요!' (공중 제비 점프)")}
                        className="py-2 px-2 border border-emerald-200 text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs col-span-2 cursor-pointer"
                      >
                        🚀 공중 덤블링 점프!
                      </button>
                      {/* Dance Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("Dance", "RoBo가 신나는 사운드 트랙을 틀고 리듬을 탑니다! 댄스 타임!")}
                        className="py-2 px-2 border border-indigo-200 text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs col-span-2 cursor-pointer"
                      >
                        🎵 신나는 댄스 (무한 루프)
                      </button>
                      {/* Punch Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("Punch", "RoBo: '원 투! 잽! 잽!' (공격 동작 시연)")}
                        className="py-2 px-2 border border-rose-200 text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                      >
                        🥊 권투 잽 잽
                      </button>
                      {/* Idle Reset Button */}
                      <button
                        onClick={() => dashboardStore.triggerRobotGesture("Idle", "RoBo가 모션 훈련을 종료하고 기본 대기 상태로 복귀합니다.")}
                        className="py-2 px-2 border border-cozy-border text-cozy-text bg-white hover:bg-apricot-secondary rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all shadow-xs cursor-pointer"
                      >
                        ⏹️ 동작 멈춤
                      </button>
                    </div>
                  </div>
                ) : (
                  // Generic appliance details
                  <div className="space-y-3.5">
                    <div>
                      <h3 className="text-[10px] font-bold text-cozy-text-light uppercase tracking-widest mb-1.5 font-mono">상태 게이지</h3>
                      <div className="p-3 border border-cozy-border bg-white/70 rounded-xl flex justify-between items-center text-xs">
                        <span className="text-cozy-text font-semibold">작동 상태</span>
                        <span className={`font-bold capitalize ${
                          selectedNode.status === "online" 
                            ? "text-emerald-600" 
                            : selectedNode.status === "warning" 
                              ? "text-amber-500" 
                              : "text-rose-500"
                        }`}>
                          {selectedNode.status === "online" ? "정상 작동 중" : selectedNode.status === "warning" ? "알림 감지됨" : "작동 중지"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTestDevice(selectedNode.id)}
                      className={`w-full py-2 border rounded-xl text-xs font-bold transition-all bg-white border-cozy-border text-cozy-text-light hover:bg-apricot-secondary/40 shadow-xs cursor-pointer`}
                    >
                      기기 작동 신호 확인 (Ping)
                    </button>
                  </div>
                )}

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center text-cozy-text-light">
                <Smile size={24} className="opacity-25 mb-3" />
                <p className="text-xs leading-relaxed font-semibold">
                  조회할 기기가 없습니다.<br />
                  3D 화면 내 오브젝트나 왼쪽 리스트의 가전을 선택해 제어해 보세요.
                </p>
              </div>
            )}
          </div>

          {/* Subsection 2: Simulation controls (turntable) */}
          <div className="p-5 border-t border-white/20 bg-white/10 rounded-t-2xl">
            <h3 className="text-[10px] font-bold text-cozy-text uppercase tracking-widest mb-3 flex items-center gap-1.5 font-mono">
              <Sliders size={11} /> 3D 조작 설정 (턴테이블)
            </h3>
            
            <div>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-cozy-text font-bold">수동 회전 각도</span>
                <span className="text-cozy-text font-black font-mono">{Math.round(dashboardStore.rotationAngle)}°</span>
              </div>
              <input 
                type="range" 
                min="-180" 
                max="180" 
                step="5"
                value={dashboardStore.rotationAngle}
                onChange={(e) => dashboardStore.setRotationAngle(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/40 rounded-lg appearance-none cursor-pointer accent-orange-500"
                style={{
                  accentColor: getThemeColors(dashboardStore.themeColor).primary
                }}
              />
              <div className="flex justify-between text-[9px] text-cozy-text-light mt-1 font-bold">
                <span>왼쪽 (-180°)</span>
                <span>정면 (0°)</span>
                <span>오른쪽 (180°)</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Panel - System Terminal Activity Log */}
      <footer className="relative z-10 border-t border-cozy-border cozy-panel h-[150px] flex flex-col rounded-t-2xl">
        <div className="px-5 py-2 border-b border-white/10 bg-white/30 flex items-center justify-between">
          <h2 className="text-[10px] font-black tracking-wider text-cozy-text flex items-center gap-1.5 uppercase font-mono">
            🤖 HOME SYSTEM ACTIVITY LOGGER
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-cozy-text-light">버퍼 보존: 최근 30개 이력</span>
            <button
              onClick={handleVoiceCommand}
              disabled={isListening}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all shadow-xs ${
                isListening
                  ? "border-rose-200 bg-rose-50 text-rose-600 cursor-wait animate-pulse"
                  : "border-cozy-border bg-white text-cozy-text hover:bg-apricot-secondary cursor-pointer"
              }`}
              title="마이크로 음성 명령을 입력합니다."
            >
              <Mic size={12} />
              {isListening ? "듣는 중..." : "Whisper"}
            </button>
            <button
              onClick={handleBrowserVoiceCommand}
              disabled={isBrowserListening}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all shadow-xs ${
                isBrowserListening
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-wait animate-pulse"
                  : "border-cozy-border bg-white text-cozy-text hover:bg-emerald-50 cursor-pointer"
              }`}
              title="브라우저 내장 무료 음성 인식으로 명령을 입력합니다."
            >
              <Mic size={12} />
              {isBrowserListening ? "듣는 중..." : "무료 음성"}
            </button>
          </div>
        </div>

        {/* Console view */}
        <div 
          ref={logContainerRef}
          className="p-4 overflow-y-auto flex-1 space-y-1 font-mono text-[11px] leading-relaxed bg-white/25 select-text selection:bg-orange-100"
        >
          {dashboardStore.logs.map((log, index) => {
            let logColor = "text-cozy-text-light";
            let prefix = "[정보]";
            if (log.type === "success") {
              logColor = "text-emerald-700 font-bold";
              prefix = "[완료]";
            } else if (log.type === "warning") {
              logColor = "text-amber-700 font-bold";
              prefix = "[주의]";
            } else if (log.type === "error") {
              logColor = "text-rose-600 font-bold";
              prefix = "[오류]";
            } else if (log.type === "robot") {
              logColor = "text-orange-700 font-black";
              prefix = "[로봇]";
            }
            
            return (
              <div key={index} className={`flex gap-3 hover:bg-white/20 px-1 rounded transition-colors ${logColor}`}>
                <span className="text-cozy-text-light shrink-0">{log.timestamp}</span>
                <span className="shrink-0">{prefix}</span>
                <span className="break-all">{log.message}</span>
              </div>
            );
          })}
        </div>
      </footer>
        </div>
      </div>
    </div>
  );
});

export default Dashboard;
