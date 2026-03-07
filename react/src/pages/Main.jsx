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

function getWeekDays(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  // We want Sunday (0) to Saturday (6)
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - day);

  const days = [];
  const dayNames = ['주', '월', '화', '수', '목', '금', '토'];
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(sunday);
    nextDay.setDate(sunday.getDate() + i);
    days.push({
      date: nextDay.toISOString().split('T')[0],
      name: dayNames[i]
    });
  }
  return days;
}

function calculateMissedDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffTime = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
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
  const [graceCards, setGraceCards] = useState(0);
  const [total100sCount, setTotal100sCount] = useState(0);
  const [streakHistory, setStreakHistory] = useState({});
  const [showDashboard, setShowDashboard] = useState(false);
  const [isKorean, setIsKorean] = useState(true);
  const [hidePart1, setHidePart1] = useState(false);
  const [hidePart2, setHidePart2] = useState(false);
  const [verseFontSize, setVerseFontSize] = useState(defaultFontSize);
  const [titleBadge, setTitleBadge] = useState(titles[0]);
  const [leavesActive, setLeavesActive] = useState(false);
  const [starlightActive, setStarlightActive] = useState(false);
  const [currentDisplaySunday, setCurrentDisplaySunday] = useState(() => getRecentSunday(new Date()));

  const currentLang = isKorean ? "ko" : "en";
  // Fallback to legacy root format if it exists, otherwise use keyed data
  const weekData = verseData?.[currentDisplaySunday] || (verseData?.ko ? verseData : null);
  const currentData = weekData?.[currentLang] || weekData?.ko || null;

  const todayDateObj = new Date();
  const todayFormatted = `${todayDateObj.getMonth() + 1}월 ${todayDateObj.getDate()}일`;
  const todayText = `${formatDate(currentDisplaySunday)} (${todayFormatted})`;

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
      // Add a cache buster based on the ACTUAL current week's Sunday date.
      // This ensures we fetch fresh data only once per week, and rely on browser cache otherwise.
      const timestamp = getRecentSunday(new Date());
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
    const todayDateOnly = new Date().toISOString().split('T')[0];
    const yesterdayDateOnly = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const savedDate = localStorage.getItem("savedDate");
    const storedCount = parseStoredNumber(localStorage.getItem("counter"), 0);
    const nextCount = savedDate === todayDateOnly ? storedCount : 0;

    let storedStreak = parseStoredNumber(localStorage.getItem("streak"), 0);
    let storedGraceCards = parseStoredNumber(localStorage.getItem("graceCards"), 0);
    let storedTotal100sCount = parseStoredNumber(localStorage.getItem("total100sCount"), 0);
    let storedStreakHistory = {};
    try {
      storedStreakHistory = JSON.parse(localStorage.getItem("streakHistory")) || {};
    } catch { }

    // Automatic Sunday Grace Card Granting
    if (new Date().getDay() === 0) { // 0 is Sunday
      const lastSundayGraceCard = localStorage.getItem("lastSundayGraceCard");
      if (lastSundayGraceCard !== todayDateOnly) {
        storedGraceCards += 1;
        localStorage.setItem("graceCards", String(storedGraceCards));
        localStorage.setItem("lastSundayGraceCard", todayDateOnly);
      }
    }

    const lastActiveDate = localStorage.getItem("lastActiveDate");

    // Check if the streak is broken (did not hit 100 yesterday or today)
    if (lastActiveDate && lastActiveDate !== todayDateOnly && lastActiveDate !== yesterdayDateOnly) {
      const missedDays = calculateMissedDays(lastActiveDate, yesterdayDateOnly);

      if (missedDays > 0) {
        if (storedGraceCards >= missedDays) {
          // Auto-recover missed days using Grace Cards
          storedGraceCards -= missedDays;
          localStorage.setItem("graceCards", String(storedGraceCards));

          let loopDate = new Date(lastActiveDate);
          for (let i = 0; i < missedDays; i++) {
            loopDate.setDate(loopDate.getDate() + 1);
            const missedDateStr = loopDate.toISOString().split('T')[0];
            storedStreakHistory[missedDateStr] = true;
          }
          localStorage.setItem("streakHistory", JSON.stringify(storedStreakHistory));

          storedStreak += missedDays;
          localStorage.setItem("streak", String(storedStreak));
          localStorage.setItem("lastActiveDate", yesterdayDateOnly); // Artificially progress the last active date
        } else {
          // Not enough cards, streak broken
          storedStreak = 0;
          localStorage.setItem("streak", "0");
        }
      }
    } else if (!lastActiveDate) {
      storedStreak = 0;
      localStorage.setItem("streak", "0");
    }

    if (savedDate !== todayDateOnly) {
      localStorage.setItem("savedDate", todayDateOnly);
      localStorage.setItem("counter", "0");
    }

    setCount(nextCount);
    setStreak(storedStreak);
    setGraceCards(storedGraceCards);
    setTotal100sCount(storedTotal100sCount);
    setStreakHistory(storedStreakHistory);
    setIsKorean(parseStoredBoolean(localStorage.getItem("isKorean"), true));
    setHidePart1(parseStoredBoolean(localStorage.getItem("hidePart1"), false));
    setHidePart2(parseStoredBoolean(localStorage.getItem("hidePart2"), false));
    setVerseFontSize(
      parseStoredNumber(localStorage.getItem("verseFontSize"), defaultFontSize),
    );

    loadData();
  }, [loadData]);

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

      // If hitting 100 for the first time today, increment streak and manage 100s
      if (next === 100) {
        const todayDateOnly = new Date().toISOString().split('T')[0];
        const lastDate = localStorage.getItem("lastActiveDate");

        if (lastDate !== todayDateOnly) {
          // Increment 100s counter and check for Grace Card reward
          setTotal100sCount((prev100) => {
            const next100 = prev100 + 1;
            localStorage.setItem("total100sCount", String(next100));

            if (next100 % 5 === 0) {
              setGraceCards((prevCards) => {
                const nextCards = prevCards + 1;
                localStorage.setItem("graceCards", String(nextCards));
                return nextCards;
              });
            }
            return next100;
          });

          // Mark day internally as completed
          setStreakHistory((prevHistory) => {
            const newHistory = { ...prevHistory, [todayDateOnly]: true };
            localStorage.setItem("streakHistory", JSON.stringify(newHistory));
            return newHistory;
          });

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
  const weekDays = useMemo(() => getWeekDays(new Date().toISOString().split('T')[0]), []);
  const badgeText = `${count}번 읊조렸습니다! [🔥 ${streak}일 연속 달성 중]`;

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

        {/* Top-level Streak Badge (Click to open Dashboard) */}
        {!showDashboard && (
          <button className="streak-badge-btn" onClick={() => setShowDashboard(true)}>
            🔥 {streak}일 연속 달성 ▾
          </button>
        )}

        <div className="counter">{count}</div>

        {/* Sleek Visual Dashboard */}
        {showDashboard && (
          <div className="streak-dashboard">
            <button className="dashboard-close-btn" onClick={() => setShowDashboard(false)}>✕</button>
            <div className="dashboard-top">
              <div className="streak-flame">
                <span className="flame-icon">🔥</span>
                <div className="flame-text">
                  <span className="tiny-label">STREAK</span>
                  <span className="big-value">{streak} DAYS</span>
                </div>
              </div>
              <div className="grace-cards" title="회복카드: 하루를 놓쳐도 연속 기록을 유지해줍니다!">
                💖 <span className="card-count">x {graceCards}</span>
              </div>
            </div>

            <div className="dashboard-middle">
              {weekDays.map((d) => (
                <div key={d.date} className="day-circle-container">
                  <div className={`day-circle ${streakHistory[d.date] ? 'completed' : ''}`}>
                    {streakHistory[d.date] && <span className="checkmark">✓</span>}
                  </div>
                  <span className="day-name">{d.name}</span>
                </div>
              ))}
            </div>

            <div className="dashboard-bottom">
              <div className="progress-labels">
                <span className="progress-title">COUNT</span>
                <span className="progress-ratio"><strong>{count}</strong> / 100</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, (count / 100) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

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
