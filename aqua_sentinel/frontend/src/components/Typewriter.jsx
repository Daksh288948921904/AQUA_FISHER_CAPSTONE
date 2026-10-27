import { useState, useEffect } from "react";

export default function Typewriter({ text, speed = 30, style = {} }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span style={style}>{displayed}<span style={{ opacity: 0.4, animation: "blink 1s step-end infinite" }}>|</span></span>;
}
