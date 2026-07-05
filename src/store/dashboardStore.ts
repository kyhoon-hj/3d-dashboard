import { makeAutoObservable, runInAction } from "mobx";

export interface HomeDevice {
  id: string;
  name: string;
  type: "robot" | "lighting" | "coffee" | "purifier" | "vacuum";
  status: "online" | "warning" | "offline";
  location: string;
  metric: number; // e.g. brightness, temperature, air quality, happiness
  description: string;
  position: [number, number, number];
}

export interface ActivityLog {
  timestamp: string;
  type: "info" | "success" | "warning" | "error" | "robot";
  message: string;
}

class DashboardStore {
  nodes: HomeDevice[] = [
    {
      id: "node-robot",
      name: "스마트 로봇 비서 (RoBo)",
      type: "robot",
      status: "online",
      location: "Home Center (거실 한가운데)",
      metric: 100, // Battery / Friendship level
      description: "집안 환경을 감시하고 가전을 관리하는 인공지능 로봇 비서입니다. 반갑게 인사를 건네거나 귀여운 동작들을 명령해 보세요!",
      position: [0, 0, 0],
    },
    {
      id: "node-living-lamp",
      name: "아늑한 스탠드 조명",
      type: "lighting",
      status: "online",
      location: "Living Room (거실 구석)",
      metric: 80, // Brightness level %
      description: "은은하고 따뜻한 전구색 빛으로 거실 전체에 편안함을 더해줍니다.",
      position: [-3.0, 0.5, 2.0],
    },
    {
      id: "node-coffee",
      name: "스마트 에스프레소 머신",
      type: "coffee",
      status: "online",
      location: "Kitchen (주방 아일랜드)",
      metric: 92, // Water level %
      description: "아침마다 고소하고 신선한 원두커피 향을 집안 가득 채워주는 일꾼입니다.",
      position: [3.0, 0.3, 1.8],
    },
    {
      id: "node-purifier",
      name: "숲속 공기청정기",
      type: "purifier",
      status: "online",
      location: "Living Room (소파 옆)",
      metric: 12, // Fine dust level (PM2.5) μg/m³
      description: "실내 미세먼지를 감지해 숲속처럼 싱그럽고 청정한 공기를 유지해 줍니다.",
      position: [-2.0, 0.1, -2.5],
    },
    {
      id: "node-vacuum",
      name: "꼬마 로봇 청소기",
      type: "vacuum",
      status: "warning",
      location: "Floor (충전 스테이션)",
      metric: 95, // Dustbin fullness %
      description: "먼지통이 거의 가득 찼습니다. 비워주지 않으면 비서 로봇이 장애물로 인식해 정지할 수 있습니다.",
      position: [2.2, 0.1, -2.2],
    },
  ];

  selectedNodeId: string | null = "node-robot";
  cameraFocusVersion = 0;

  metrics = {
    comfortScore: 96, // 쾌적도 %
    temperature: 23.5, // 온도 ℃
    humidity: 50, // 습도 %
    energyUsage: 124, // 소비 전력 W
  };

  // Rotation controls (Angle in degrees: 0 to 360)
  rotationAngle = 0;
  themeColor: "apricot" | "sage" | "lavender" = "apricot";
  logs: ActivityLog[] = [];

  // Animated Robot state
  robotAnimation: string = "Wave"; // Initial wave animation
  private animationTimeout: NodeJS.Timeout | null = null;
  private telemetryTimer: NodeJS.Timeout | null = null;

  constructor() {
    makeAutoObservable(this);

    // Initial logs
    this.addLog("스마트 홈 제어 시스템이 부팅되었습니다.", "success");
    this.addLog("RoBo가 눈을 깜빡이며 시스템 연동을 시작합니다.", "robot");
    this.addLog("RoBo: '안녕하세요! 반갑습니다!' (손 흔들며 인사하는 중)", "robot");
    this.addLog("스탠드 조명이 아늑한 웜톤 라이팅으로 켜졌습니다.", "info");

    // Automatically transition to Idle after waving
    if (typeof window !== "undefined") {
      this.animationTimeout = setTimeout(() => {
        this.setRobotAnimation("Idle");
      }, 3500);

      // Telemetry loop
      this.telemetryTimer = setInterval(() => this.simulateHomeTelemetry(), 3000);
    }
  }

  destroy() {
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
    }
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
    }
  }

  // Actions
  selectNode(id: string | null) {
    this.selectedNodeId = id;
    this.cameraFocusVersion += 1;
    if (id) {
      const node = this.nodes.find((n) => n.id === id);
      if (node) {
        if (node.type === "robot") {
          this.addLog("비서 로봇 RoBo를 모니터링 중입니다.", "robot");
          this.triggerRobotGesture("Wave", "RoBo: '안녕하세요! 어떤 명령을 수행할까요?'");
        } else {
          this.addLog(`기기 정보 조회: [${node.name}] 연결 완료.`, "info");
        }
      }
    } else {
      this.addLog("거실 전체 카메라 오버뷰로 복귀했습니다.", "info");
    }
  }

  setRotationAngle(angle: number) {
    this.rotationAngle = angle;
    // Log occasionally to avoid spam
    if (Math.abs(angle % 30) < 5) {
      this.addLog(`로봇 회전 플레이트 각도가 ${Math.round(angle)}°로 변경되었습니다.`, "info");
    }
  }

  resetView() {
    this.selectedNodeId = "node-robot";
    this.rotationAngle = 0;
    this.addLog("카메라와 관찰판 구도가 최초 상태로 초기화되었습니다.", "success");
    
    // Wave greeting on view reset
    this.triggerRobotGesture("Wave", "RoBo: '반갑습니다! 화면이 초기화되었습니다!'");
  }

  setThemeColor(color: "apricot" | "sage" | "lavender") {
    this.themeColor = color;
    const colorKorean = color === "apricot" ? "살구색(Apricot)" : color === "sage" ? "올리브 그린(Sage)" : "라벤더(Lavender)";
    this.addLog(`집안의 조명 테마가 아늑한 ${colorKorean} 색감으로 연출됩니다.`, "success");
    
    // Robot nods yes to confirm
    this.triggerRobotGesture("Yes", `RoBo가 테마 변경에 호응해 머리를 끄덕입니다.`);
  }

  addLog(message: string, type: ActivityLog["type"] = "info") {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    this.logs.unshift({ timestamp: time, type, message });

    if (this.logs.length > 30) {
      this.logs.pop();
    }
  }

  toggleNodeStatus(id: string) {
    const node = this.nodes.find((n) => n.id === id);
    if (node) {
      const wasOnline = node.status === "online" || node.status === "warning";
      node.status = wasOnline ? "offline" : "online";

      this.addLog(
        `기기 전원 제어: [${node.name}] 기기가 ${wasOnline ? "꺼졌습니다" : "켜졌습니다"}.`,
        wasOnline ? "error" : "success"
      );

      // Robot reacts to appliance triggers
      if (wasOnline) {
        this.triggerRobotGesture("No", `RoBo: '${node.name} 전원을 껐습니다.' (도리도리)`);
      } else {
        this.triggerRobotGesture("ThumbsUp", `RoBo: '${node.name} 전원을 켰습니다!' (엄지 척)`);
      }

      this.recalculateHomeComfort();
    }
  }

  handleVoiceCommand(transcript: string) {
    const normalizedText = transcript.replace(/\s/g, "");

    this.addLog(`음성 인식: "${transcript}"`, "info");

    if (!normalizedText) {
      this.addLog("음성 명령이 비어 있습니다. 다시 말씀해 주세요.", "warning");
      return;
    }

    if (
      normalizedText.includes("인사") ||
      normalizedText.includes("안녕") ||
      normalizedText.includes("반가")
    ) {
      this.triggerRobotGesture("Wave", "음성 명령: 인사 동작을 실행합니다.");
      return;
    }

    if (
      normalizedText.includes("엄지") ||
      normalizedText.includes("칭찬") ||
      normalizedText.includes("대단") ||
      normalizedText.includes("나어때")
    ) {
      this.triggerRobotGesture("ThumbsUp", "음성 명령: 엄지척 동작을 실행합니다.");
      return;
    }

    if (normalizedText.includes("끄덕") || normalizedText.includes("그렇") || normalizedText.includes("맞아")) {
      this.triggerRobotGesture("Yes", "음성 명령: 끄덕임 동작을 실행합니다.");
      return;
    }

    if (normalizedText.includes("도리") || normalizedText.includes("아니")) {
      this.triggerRobotGesture("No", "음성 명령: 도리도리 동작을 실행합니다.");
      return;
    }

    if (normalizedText.includes("점프")) {
      this.triggerRobotGesture("Jump", "음성 명령: 점프 동작을 실행합니다.");
      return;
    }

    if (normalizedText.includes("춤") || normalizedText.includes("댄스")) {
      this.triggerRobotGesture("Dance", "음성 명령: 댄스 동작을 실행합니다.");
      return;
    }

    if (normalizedText.includes("멈춰") || normalizedText.includes("정지")) {
      this.triggerRobotGesture("Idle", "음성 명령: 기본 대기 상태로 전환합니다.");
      return;
    }

    if (normalizedText.includes("초기화") || normalizedText.includes("리셋")) {
      this.resetView();
      return;
    }

    if (normalizedText.includes("살구")) {
      this.setThemeColor("apricot");
      return;
    }

    if (normalizedText.includes("세이지") || normalizedText.includes("초록")) {
      this.setThemeColor("sage");
      return;
    }

    if (normalizedText.includes("라벤더") || normalizedText.includes("보라")) {
      this.setThemeColor("lavender");
      return;
    }

    const deviceCommand = [
      { keywords: ["조명", "스탠드"], id: "node-living-lamp" },
      { keywords: ["청소기", "청소"], id: "node-vacuum" },
      { keywords: ["커피", "에스프레소", "커피머신"], id: "node-coffee" },
      { keywords: ["공기청정기", "공기청정", "청정기", "공기"], id: "node-purifier" },
      { keywords: ["비서", "로봇", "로보"], id: "node-robot" },
    ].find((command) => command.keywords.some((keyword) => normalizedText.includes(keyword)));

    if (deviceCommand) {
      if (normalizedText.includes("켜") || normalizedText.includes("꺼") || normalizedText.includes("전원")) {
        if (deviceCommand.id === "node-robot") {
          this.triggerRobotGesture("No", "음성 명령: 비서 로봇 전원 제어는 지원하지 않습니다.");
          return;
        }

        this.toggleNodeStatus(deviceCommand.id);
        return;
      }

      this.selectNode(deviceCommand.id);
      return;
    }

    const looksLikeQuestion =
      transcript.includes("?") ||
      ["뭐", "무엇", "어때", "어디", "왜", "언제", "누구", "인가", "나요", "까요", "습니까", "니"].some(
        (keyword) => normalizedText.includes(keyword)
      );

    if (looksLikeQuestion) {
      const gesture = Math.random() > 0.5 ? "Yes" : "No";
      this.triggerRobotGesture(
        gesture,
        gesture === "Yes"
          ? "음성 질문: RoBo가 끄덕끄덕으로 대답합니다."
          : "음성 질문: RoBo가 도리도리로 대답합니다."
      );
      return;
    }

    this.addLog(`이해하지 못한 음성 명령: "${transcript}"`, "warning");
    this.triggerRobotGesture("No", "RoBo가 음성 명령을 이해하지 못해 고개를 젓습니다.");
  }

  // Animation controller
  setRobotAnimation(name: string) {
    this.robotAnimation = name;
  }

  // Action helper to trigger animations and logs
  triggerRobotGesture(name: string, logMsg?: string) {
    if (this.animationTimeout) {
      clearTimeout(this.animationTimeout);
      this.animationTimeout = null;
    }

    runInAction(() => {
      this.setRobotAnimation(name);
      if (logMsg) {
        this.addLog(logMsg, "robot");
      }
    });

    const transientGestures: Record<string, number> = {
      Wave: 3500,
      Jump: 1800,
      ThumbsUp: 2200,
      Yes: 2000,
      No: 2000,
      Punch: 2000,
    };

    if (name in transientGestures) {
      this.animationTimeout = setTimeout(() => {
        runInAction(() => {
          this.setRobotAnimation("Idle");
        });
      }, transientGestures[name]);
    }
  }

  private recalculateHomeComfort() {
    const offlineAppliances = this.nodes.filter(
      (n) => n.type !== "robot" && n.status === "offline"
    );
    const warningAppliances = this.nodes.filter(
      (n) => n.type !== "robot" && n.status === "warning"
    );

    let score = 95;
    score -= offlineAppliances.length * 10;
    score -= warningAppliances.length * 5;

    this.metrics.comfortScore = Math.max(0, Math.min(100, Math.round(score)));
  }

  private simulateHomeTelemetry() {
    runInAction(() => {
      // Temperature fluctuation around 23.5C
      const tempDiff = Math.random() * 0.4 - 0.2;
      this.metrics.temperature = parseFloat(
        (this.metrics.temperature + tempDiff).toFixed(1)
      );

      // Humidity fluctuation around 50%
      const humDiff = Math.round(Math.random() * 4 - 2);
      this.metrics.humidity = Math.max(30, Math.min(75, this.metrics.humidity + humDiff));

      // Calculate total power usage
      let power = 30;
      this.nodes.forEach((node) => {
        if (node.status === "offline" || node.type === "robot") return;
        
        if (node.type === "lighting") {
          power += Math.round(node.metric * 0.4);
        } else if (node.type === "coffee") {
          power += 40 + Math.round(Math.random() * 8);
        } else if (node.type === "purifier") {
          power += 15;
        } else if (node.type === "vacuum") {
          power += 35;
        }
      });

      if (this.robotAnimation === "Dance") {
        power += 25;
      }
      this.metrics.energyUsage = power;

      // Update node metrics
      this.nodes.forEach((node) => {
        if (node.status === "offline") return;

        if (node.type === "robot") {
          if (Math.random() > 0.95) {
            node.metric = Math.max(50, node.metric - 1);
          }
        } else if (node.type === "purifier") {
          node.metric = Math.max(4, Math.round(node.metric + (Math.random() * 2 - 1.6)));
        }
      });

      // Cute periodic home activities
      if (Math.random() > 0.88) {
        const robotStatusLogs = [
          { msg: "RoBo가 집안 무선 센서들의 펌웨어를 무선 업데이트했습니다.", type: "robot" },
          { msg: "공기청정기가 쾌적한 에어 밸런스를 측정하고 팬 속도를 미세 조절합니다.", type: "success" },
          { msg: "RoBo: '스탠드 조명 주변 조도가 안정적입니다. 독서하기 좋은 상태예요.'", type: "robot" },
          { msg: "에스프레소 머신의 예열이 완료되어 상시 대기 모드로 진입합니다.", type: "info" },
        ];

        const vacuum = this.nodes.find((n) => n.id === "node-vacuum");
        if (vacuum && vacuum.status === "warning" && Math.random() > 0.5) {
          this.addLog("RoBo가 로봇 청소기 필터를 확인하고 먼지 비움 알림을 활성화했습니다.", "warning");
        } else {
          const choice = robotStatusLogs[Math.floor(Math.random() * robotStatusLogs.length)];
          this.addLog(choice.msg, choice.type as ActivityLog["type"]);
        }
      }
    });
  }
}

export const dashboardStore = new DashboardStore();
export type { ActivityLog as Log };
