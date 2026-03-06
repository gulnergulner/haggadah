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

const rewardColors = [
  "#ff6b6b",
  "#ffc75f",
  "#4ecdc4",
  "#b983ff",
  "#4da3ff",
  "#ff8fab",
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

function Main() {
  const [verseData, setVerseData] = useState(null);
  const [count, setCount] = useState(0);
  const [isKorean, setIsKorean] = useState(true);
  const [hidePart1, setHidePart1] = useState(false);
  const [hidePart2, setHidePart2] = useState(false);
  const [verseFontSize, setVerseFontSize] = useState(defaultFontSize);
  const [todayText, setTodayText] = useState("");
  const [titleBadge, setTitleBadge] = useState(titles[0]);
  const [flashActive, setFlashActive] = useState(false);
  const [firework, setFirework] = useState(null);
  const [reward, setReward] = useState(null);
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
      // Add a cache buster so we always get fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(`${dataUrl}?t=${timestamp}`);
      if (response.ok) {
        const json = await response.json();
        localStorage.setItem("verseData", JSON.stringify(json));
        setVerseData(json);
        return; // Success! Return early
      }
    } catch {
      // ignore network errors
    }

    // Fallback to cache ONLY if network fails
    const cached = localStorage.getItem("verseData");
    if (cached) {
      try {
        setVerseData(JSON.parse(cached));
      } catch {
        localStorage.removeItem("verseData");
      }
    }
  }, []);

  useEffect(() => {
    const todayStr = formatDate(currentDisplaySunday);
    setTodayText(todayStr);

    const todayDateOnly = new Date().toISOString().split('T')[0];

    const savedDate = localStorage.getItem("savedDate");
    const storedCount = parseStoredNumber(localStorage.getItem("counter"), 0);
    const nextCount = savedDate === todayDateOnly ? storedCount : 0;

    if (savedDate !== todayDateOnly) {
      localStorage.setItem("savedDate", todayDateOnly);
      localStorage.setItem("counter", "0");
    }

    setCount(nextCount);
    setTitleBadge(
      titles[Math.min(Math.floor(nextCount / 20), titles.length - 1)],
    );
    setIsKorean(parseStoredBoolean(localStorage.getItem("isKorean"), true));
    setHidePart1(parseStoredBoolean(localStorage.getItem("hidePart1"), false));
    setHidePart2(parseStoredBoolean(localStorage.getItem("hidePart2"), false));
    setVerseFontSize(
      parseStoredNumber(localStorage.getItem("verseFontSize"), defaultFontSize),
    );

    loadData();
  }, [loadData, currentDisplaySunday]);

  useEffect(() => {
    const index = Math.min(Math.floor(count / 20), titles.length - 1);
    setTitleBadge(titles[index]);
  }, [count]);

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

      if (next % 10 === 0) {
        triggerFirework(next);
        triggerFlash();
      }

      if (next === 100) {
        triggerReward();
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

  const triggerFlash = () => {
    setFlashActive(true);
    window.setTimeout(() => setFlashActive(false), 1600);
  };

  const triggerFirework = (milestone) => {
    const burstSparks = Array.from({ length: 60 }).map((_, index) => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 80 + Math.random() * 200;
      return {
        id: `f-${Date.now()}-${index}`,
        tx: Math.cos(angle) * velocity,
        ty: Math.sin(angle) * velocity,
        color: rewardColors[Math.floor(Math.random() * rewardColors.length)],
        delay: Math.random() * 0.15,
        scale: 0.5 + Math.random() * 1.5,
      };
    });
    setFirework({ id: Date.now(), sparks: burstSparks, text: `${milestone}번 읊조림! 🔥` });
    window.setTimeout(() => setFirework(null), 2000);
  };

  const triggerReward = () => {
    const balloons = Array.from({ length: 12 }).map((_, index) => ({
      id: `b-${Date.now()}-${index}`,
      left: Math.random() * 100,
      size: 36 + Math.random() * 26,
      delay: Math.random() * 0.3,
      drift: (Math.random() - 0.5) * 120,
      color: rewardColors[Math.floor(Math.random() * rewardColors.length)],
    }));

    const confetti = Array.from({ length: 40 }).map((_, index) => ({
      id: `c-${Date.now()}-${index}`,
      left: Math.random() * 100,
      size: 6 + Math.random() * 8,
      delay: Math.random() * 0.4,
      drift: (Math.random() - 0.5) * 160,
      rotation: Math.random() * 360,
      color: rewardColors[Math.floor(Math.random() * rewardColors.length)],
    }));

    setReward({ id: Date.now(), balloons, confetti });
    window.setTimeout(() => setReward(null), 5000);
  };

  const part1Lines = useMemo(
    () => splitWithBreaks(currentData?.part1),
    [currentData?.part1],
  );
  const part2Lines = useMemo(
    () => splitWithBreaks(currentData?.part2),
    [currentData?.part2],
  );

  return (
    <div className={`app ${flashActive ? "flash" : ""}`}>
      <header className="header" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
          <button onClick={handlePrevWeek} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>&lt; 이전</button>
        </div>
        <div className="header-center">
          <div className="date">{todayText}</div>
          <div className="title-badge">{titleBadge}</div>
        </div>
        <div className="font-buttons">
          <button onClick={handleNextWeek} style={{ marginRight: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>다음 &gt;</button>
          <button className="font-button" onClick={handleDecreaseFont}>
            -
          </button>
          <button className="font-button" onClick={handleIncreaseFont}>
            +
          </button>
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
        <div className="counter">{count}</div>
        <div className="button-row">
          <button className="btn reset" onClick={handleResetCounter}>
            {isKorean ? "리셋" : "Reset"}
          </button>
          <button className="btn toggle" onClick={handleToggleLanguage}>
            {isKorean ? "영문" : "Korean"}
          </button>
          <button className="btn hide" onClick={handleTogglePart1}>
            {hidePart1 ? "SHOW1" : "HIDE1"}
          </button>
          <button className="btn hide" onClick={handleTogglePart2}>
            {hidePart2 ? "SHOW2" : "HIDE2"}
          </button>
        </div>
        <div className="button-row">
          <button className="btn increase" onClick={handleIncreaseCounter}>
            +1
          </button>
        </div>
      </section>

      {firework && (
        <div className="firework-container" key={firework.id}>
          {firework.sparks.map((spark) => (
            <div
              key={spark.id}
              className="firework-spark"
              style={{
                backgroundColor: spark.color,
                boxShadow: `0 0 10px ${spark.color}`,
                "--tx": `${spark.tx}px`,
                "--ty": `${spark.ty}px`,
                "--scale": spark.scale,
                animationDelay: `${spark.delay}s`,
              }}
            />
          ))}
          <div className="firework-text">{firework.text}</div>
        </div>
      )}

      {reward && (
        <div className="reward-overlay" key={reward.id}>
          {reward.balloons.map((balloon) => (
            <div
              key={balloon.id}
              className="reward-balloon"
              style={{
                left: `${balloon.left}%`,
                width: `${balloon.size}px`,
                height: `${balloon.size * 1.3}px`,
                backgroundColor: balloon.color,
                animationDelay: `${balloon.delay}s`,
                "--drift": `${balloon.drift}px`,
              }}
            />
          ))}
          {reward.confetti.map((piece) => (
            <div
              key={piece.id}
              className="reward-confetti"
              style={{
                left: `${piece.left}%`,
                width: `${piece.size}px`,
                height: `${piece.size * 1.6}px`,
                backgroundColor: piece.color,
                animationDelay: `${piece.delay}s`,
                "--drift": `${piece.drift}px`,
                "--rotation": `${piece.rotation}deg`,
              }}
            />
          ))}
          <div className="reward-card">
            <div className="reward-title">🎉 100회 달성! 🎉</div>
            <div className="reward-subtitle">
              {isKorean
                ? "말씀의 챔피언이 되었어요!"
                : "You are a Word Champion!"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Main;
