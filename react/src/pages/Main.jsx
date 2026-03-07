import { useCallback, useEffect, useMemo, useState } from "react";
import "./Main.css";

const dataUrl = "/data.json";
const defaultFontSize = 20;
const minFontSize = 12;

const titles = [
  "🌱 새싹",
  "⭐ 말씀 지킴이",
  "🔥 신앙의 불꽃",
  "💎 믿음의 보석",
  "🌟 빛의 증인",
  "🏆 말씀의 챔피언",
];

const plantStages = [
  { threshold: 300, emoji: "🌟", name: "빛의 증인", desc: "300번 달성! 세상에 빛을 비추는 증인이 되었어요" },
  { threshold: 200, emoji: "💎", name: "믿음의 보석", desc: "200번 달성! 빛나는 보석 같아요" },
  { threshold: 100, emoji: "🍎", name: "풍성한 열매", desc: "100번 달성! 열매가 가득 맺혔어요" },
  { threshold: 50, emoji: "🌳", name: "무성한 나무", desc: "말씀의 그늘이 시원하게 드리워요" },
  { threshold: 25, emoji: "🌿", name: "작은 나무", desc: "말씀의 뿌리가 깊게 내려요" },
  { threshold: 10, emoji: "🌱", name: "새싹", desc: "말씀의 싹이 텄어요" },
  { threshold: 0, emoji: "🫘", name: "말씀 씨앗", desc: "은혜의 단비가 내려요" },
];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 주간`;
}

function getRecentSunday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);

  // Format locally YYYY-MM-DD
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dom = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${dom}`;
}

function parseStoredBoolean(value, fallback) {
  if (value == null) return fallback;
  return value === "true";
}

function parseStoredNumber(value, fallback) {
  if (value == null) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function splitWithBreaks(text) {
  if (!text) return [""];
  return text.split(/<br\s*\/?>(\n)?/gi).filter((chunk) => chunk !== undefined);
}

function computeStreakBadge(streak, currentCount) {
  if (currentCount >= 100 && streak > 0) {
    return `🏆 100회 달성 ${streak}일차!`;
  }
  if (streak > 0) {
    return `🔥 ${streak}일 연속 달성 중`;
  }
  return currentCount >= 100 ? "🏆 오늘 100회 달성!" : "첫걸음을 응원해요 🌱";
}

function Main() {
  const [verseData, setVerseData] = useState(() => {
    const cached = localStorage.getItem("verseData");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        localStorage.removeItem("verseData");
      }
    }
    return null;
  });
  const [count, setCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isKorean, setIsKorean] = useState(true);
  const [hidePart1, setHidePart1] = useState(false);
  const [hidePart2, setHidePart2] = useState(false);
  const [verseFontSize, setVerseFontSize] = useState(defaultFontSize);
  const [todayText, setTodayText] = useState("");
  const [titleBadge, setTitleBadge] = useState(titles[0]);
  const [leavesActive, setLeavesActive] = useState(false);
  const [starlightActive, setStarlightActive] = useState(false);
  const [currentDisplaySunday, setCurrentDisplaySunday] = useState(() => getRecentSunday(new Date()));

  const currentLang = isKorean ? "ko" : "en";
  // Fallback to legacy root format if it exists, otherwise use keyed data
  const weekData = verseData?.[currentDisplaySunday] || (verseData?.ko ? verseData : null);
  const currentData = weekData?.[currentLang] || weekData?.ko || null;

  const handlePrevWeek = () => {
    const d = new Date(currentDisplaySunday);
    d.setDate(d.getDate() - 7);
    setCurrentDisplaySunday(d.toISOString().split('T')[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDisplaySunday);
    d.setDate(d.getDate() + 7);
    setCurrentDisplaySunday(d.toISOString().split('T')[0]);
  };

  const loadData = useCallback(async () => {
    try {
      // Add a cache buster so we always get fresh data silently in the background
      const timestamp = new Date().getTime();
      const response = await fetch(`${dataUrl}?t=${timestamp}`);
      if (response.ok) {
        const json = await response.json();
        localStorage.setItem("verseData", JSON.stringify(json));

        // Prevent unnecessary re-renders if the data hasn't actually changed
        setVerseData((prevData) => {
          if (JSON.stringify(prevData) === JSON.stringify(json)) {
            return prevData;
          }
          return json;
        });
      }
    } catch {
      // ignore network errors, we already have the cached data rendered
    }
  }, []);

  useEffect(() => {
    const d = new Date();
    const todayFormatted = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    const todayStr = `${formatDate(currentDisplaySunday)} (${todayFormatted})`;
    setTodayText(todayStr);

    const todayDateOnly = new Date().toISOString().split('T')[0];
    const yesterdayDateOnly = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const savedDate = localStorage.getItem("savedDate");
    const storedCount = parseStoredNumber(localStorage.getItem("counter"), 0);
    const nextCount = savedDate === todayDateOnly ? storedCount : 0;

    let storedStreak = parseStoredNumber(localStorage.getItem("streak"), 0);
    const lastActiveDate = localStorage.getItem("lastActiveDate");

    // Check if the streak is broken (did not hit 100 yesterday or today)
    if (lastActiveDate !== todayDateOnly && lastActiveDate !== yesterdayDateOnly) {
      storedStreak = 0;
      localStorage.setItem("streak", "0");
    }

    if (savedDate !== todayDateOnly) {
      localStorage.setItem("savedDate", todayDateOnly);
      localStorage.setItem("counter", "0");
    }

    setCount(nextCount);
    setStreak(storedStreak);
    setIsKorean(parseStoredBoolean(localStorage.getItem("isKorean"), true));
    setHidePart1(parseStoredBoolean(localStorage.getItem("hidePart1"), false));
    setHidePart2(parseStoredBoolean(localStorage.getItem("hidePart2"), false));
    setVerseFontSize(
      parseStoredNumber(localStorage.getItem("verseFontSize"), defaultFontSize),
    );

    loadData();
  }, [loadData, currentDisplaySunday]);

  const handleToggleLanguage = () => {
    setIsKorean((prev) => {
      const next = !prev;
      localStorage.setItem("isKorean", String(next));
      return next;
    });
  };

  const handleTogglePart1 = () => {
    setHidePart1((prev) => {
      const next = !prev;
      localStorage.setItem("hidePart1", String(next));
      return next;
    });
  };

  const handleTogglePart2 = () => {
    setHidePart2((prev) => {
      const next = !prev;
      localStorage.setItem("hidePart2", String(next));
      return next;
    });
  };

  const handleIncreaseCounter = () => {
    setCount((prev) => {
      const next = prev + 1;
      localStorage.setItem("counter", String(next));

      // Trigger visual effects
      if (next === 100) {
        setStarlightActive(true);
        window.setTimeout(() => setStarlightActive(false), 4000);
        // Also trigger falling leaves for 100
        setLeavesActive(true);
        window.setTimeout(() => setLeavesActive(false), 3000);
      } else if (next % 10 === 0 && next > 0) {
        setLeavesActive(true);
        window.setTimeout(() => setLeavesActive(false), 3000);
      }

      // If hitting 100 for the first time today, increment streak
      if (next === 100) {
        const todayDateOnly = new Date().toISOString().split('T')[0];
        const lastDate = localStorage.getItem("lastActiveDate");

        if (lastDate !== todayDateOnly) {
          setStreak((prevStreak) => {
            const nextStreak = prevStreak + 1;
            localStorage.setItem("streak", String(nextStreak));
            localStorage.setItem("lastActiveDate", todayDateOnly);
            return nextStreak;
          });
        }
      }

      return next;
    });
  };

  const handleResetCounter = () => {
    setCount(0);
    localStorage.setItem("counter", "0");
  };

  const handleIncreaseFont = () => {
    setVerseFontSize((prev) => {
      const next = prev + 4;
      localStorage.setItem("verseFontSize", String(next));
      return next;
    });
  };

  const handleDecreaseFont = () => {
    setVerseFontSize((prev) => {
      const next = Math.max(minFontSize, prev - 4);
      localStorage.setItem("verseFontSize", String(next));
      return next;
    });
  };

  const handleShare = async () => {
    const textToShare = `${count}번 읊조렸습니다.`;

    if (navigator.share) {
      try {
        await navigator.share({
          text: textToShare,
        });
      } catch (err) {
        // user cancelled or share failed silently
      }
    } else {
      // Fallback for browsers that don't support Web Share API
      try {
        await navigator.clipboard.writeText(textToShare);
        alert("클립보드에 복사되었습니다!");
      } catch (err) {
        alert("공유하기를 지원하지 않는 브라우저입니다.");
      }
    }
  };

  const currentPlant = plantStages.find((s) => count >= s.threshold);
  const badgeText = computeStreakBadge(streak, count);

  const part1Lines = useMemo(
    () => splitWithBreaks(currentData?.part1),
    [currentData?.part1],
  );

  const part2Lines = useMemo(
    () => splitWithBreaks(currentData?.part2),
    [currentData?.part2],
  );

  return (
    <div className="app">
      <header className="header">
        <div className="header-center">
          <div className="week-navigation">
            <button className="nav-arrow" onClick={handlePrevWeek} aria-label="이전 주">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="date">{todayText}</div>
            <button className="nav-arrow" onClick={handleNextWeek} aria-label="다음 주">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="divider"></div>
            <button className="font-button" onClick={handleDecreaseFont} aria-label="글자 크기 축소">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
              </svg>
            </button>
            <button className="font-button" onClick={handleIncreaseFont} aria-label="글자 크기 확대">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <div className="growth-stage">
            <div className="plant-emoji" key={currentPlant.emoji}>{currentPlant.emoji}</div>
            <div className="plant-info">
              <div className="plant-name">{currentPlant.name}</div>
              <div className="plant-desc">{currentPlant.desc}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="verse-container">
        <div className="verse">
          <div
            className="verse-title"
            style={{ fontSize: `${Math.max(14, verseFontSize * 0.8)}px` }}
          >
            {currentData ? (currentData.title || "") : "이 주간 등록된 말씀이 없습니다."}
          </div>
          <div
            className={`verse-part ${hidePart1 ? "hidden" : ""}`}
            style={{ fontSize: `${verseFontSize}px` }}
          >
            {part1Lines.map((line, index) => (
              <span key={`p1-${index}`}>
                {line}
                <br />
              </span>
            ))}
          </div>
          <div
            className={`verse-part ${hidePart2 ? "hidden" : ""}`}
            style={{ fontSize: `${verseFontSize}px` }}
          >
            {part2Lines.map((line, index) => (
              <span key={`p2-${index}`}>
                {line}
                <br />
              </span>
            ))}
          </div>
        </div>
      </main>

      <section className="control-panel">
        <div className="streak-badge">
          {badgeText}
        </div>
        <div className="counter">{count}</div>
        <div className="button-row">
          <button className="btn reset" onClick={handleResetCounter}>
            {isKorean ? "리셋" : "Reset"}
          </button>
          <button className="btn toggle" onClick={handleToggleLanguage}>
            {isKorean ? "English" : "한국어"}
          </button>
          <button className="btn hide" onClick={handleTogglePart1}>
            {hidePart1 ? "SHOW1" : "HIDE1"}
          </button>
          <button className="btn hide" onClick={handleTogglePart2}>
            {hidePart2 ? "SHOW2" : "HIDE2"}
          </button>
          <button className="btn share" style={{ background: "linear-gradient(to bottom, #9c27b0, #7b1fa2)" }} onClick={handleShare}>
            {isKorean ? "공유" : "Share"}
          </button>
        </div>
        <div className="button-row">
          <button className="btn increase" onClick={handleIncreaseCounter}>
            +1
          </button>
        </div>
      </section>

      {/* 10-count falling leaves effect */}
      {leavesActive && (
        <div className="effect-container leaves-container">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="leaf-particle"
              style={{
                left: `${Math.random() * 100}%`,
                "--animationDelay": `${Math.random() * 1.5}s`,
                "--animationDuration": `${2.5 + Math.random() * 2}s`,
                fontSize: `${20 + Math.random() * 14}px`,
                transform: `rotate(${Math.random() * 360}deg)`
              }}
            >
              🌿
            </div>
          ))}
        </div>
      )}

      {/* 100-count starlight effect */}
      {starlightActive && (
        <div className="effect-container starlight-container">
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="starlight-particle"
              style={{
                "--driftX": `${(Math.random() - 0.5) * 150}px`,
                "--riseY": `-${100 + Math.random() * 80}vh`,
                "--duration": `${2.5 + Math.random() * 2}s`,
                "--delay": `${Math.random() * 1.5}s`,
                left: `${10 + Math.random() * 80}%`, // Stay mostly in bounds
                bottom: "-20px"
              }}
            />
          ))}
        </div>
      )}

    </div>
  );
}

export default Main;
