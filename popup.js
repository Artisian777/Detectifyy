// popup.js

const scoreRegex = /truth\s*score\s*[:\-]?\s*(\d(?:\.\d+)?)/i;

document.addEventListener("DOMContentLoaded", () => {
  const scanStatus         = document.getElementById("scanStatus");
  const scoreBox           = document.getElementById("scoreBox");
  const scoreValue         = document.getElementById("scoreValue");
  const scoreText          = document.getElementById("scoreText");
  const closeBtn           = document.getElementById("close");
  const explanationEl      = document.getElementById("explanationText");
  const explainBtn         = document.getElementById("explainBtn");
  const whyScoreBtn        = document.getElementById("whyScoreBtn");
  const scoreExplanationEl = document.getElementById("scoreExplanation");
  const scanModeText       = document.getElementById("scanMode");
  const biasToneBtn        = document.getElementById("biasToneBtn");
  const biasToneBlock      = document.getElementById("biasToneBlock");
  const toneEl             = document.getElementById("toneText");
  const biasEl             = document.getElementById("biasText");
  const html               = document.documentElement;
  const themeToggle        = document.getElementById("themeToggle");
  const themeIcon          = document.getElementById("themeIcon");

  // Initialize Bias & Tone button text
  biasToneBtn.textContent = biasToneBlock.style.display === "block"
    ? "Hide Bias & Tone"
    : "Bias & Tone Analysis";

  // Load stored theme
  chrome.storage.local.get("theme", ({ theme }) => {
    const isLight = theme === "light";
    html.setAttribute("data-theme", isLight ? "light" : "dark");
    themeIcon.textContent = isLight ? "☀️" : "🌙";
  });

  // Theme toggle handler
  themeToggle.addEventListener("click", () => {
    const currentTheme = html.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    html.setAttribute("data-theme", newTheme);
    themeIcon.textContent = newTheme === "light" ? "☀️" : "🌙";
    chrome.storage.local.set({ theme: newTheme });
  });

  // Bias & Tone toggle handler
  biasToneBtn.onclick = () => {
    const isVisible = biasToneBlock.style.display === "block";
    biasToneBlock.style.display = isVisible ? "none" : "block";
    toneEl.style.display = isVisible ? "none" : "block";
    biasEl.style.display = isVisible ? "none" : "block";
    biasToneBtn.textContent = isVisible
      ? "Bias & Tone Analysis"
      : "Hide Bias & Tone";
  };

  // Emoji feedback buttons
  document.querySelectorAll(".emoji").forEach(button => {
    button.addEventListener("click", () => {
      const feedback = button.dataset.feedback;
      chrome.runtime.sendMessage({ action: "userFeedback", feedback });
      button.parentElement.style.display = "none";
      document.getElementById("thanks").classList.remove("hidden");
    });
  });

  // Retrieve selected text + mode from chrome.storage
  chrome.storage.local.get(["text", "mode"], ({ text, mode }) => {
    let prompt = "";

    if (mode === "deep") {
      scanModeText.textContent = "Deep Scan";
      prompt = `Fact-check the following claim using no fewer than 4 reputable sources.

Use the following guide to assign a Truth Score from 0 to 5:
0: False – No evidence, clearly debunked  
1: Mostly False – Mostly inaccurate, may misuse isolated facts  
2: Probably False – Lacks support from credible sources  
3: Partially True – Mix of true/false, some valid points  
4: Mostly True – Largely accurate with small caveats  
5: Verified True – Fully supported, consistent across trusted sources

Have it in a format of display as:
- Truth Score: [number]
- Tone: [describe tone of the claim]
- Bias: [describe any bias present]
- Summary: brief summary of findings
- Reasoning: explain why the score was given and what caveats prevented a higher score.
- References: list links and publication titles if available.

Claim: "${text}"`;
    } else {
      scanModeText.textContent = "Scan";
      prompt = `Fact-check the following claim using no more than 2 reputable sources.

Use the following guide to assign a Truth Score from 0 to 5:
0: False – No evidence, clearly debunked  
1: Mostly False – Mostly inaccurate, may misuse isolated facts  
2: Probably False – Lacks support from credible sources  
3: Partially True – Mix of true/false, some valid points  
4: Mostly True – Largely accurate with small caveats  
5: Verified True – Fully supported, consistent across trusted sources

Have it in a format of display as:
- Truth Score: [number]
- Tone: [describe tone of the claim]
- Bias: [describe any bias present]
- Summary: brief summary of findings
- Reasoning: explain why the score was given and what caveats prevented a higher score.
- References: list links and publication titles if available.

Claim: "${text}"`;
    }

    // Show “Scanning...” animation/text
    scanStatus.classList.add("scanning");
    scanStatus.textContent = `Scanning (${mode === "deep" ? "Deep Scan" : "Scan"})...`;

    // Call external backend (Railway) instead of OpenAI directly
    fetch("https://detectifyy-production.up.railway.app/api/factcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt })
    })
      .then(res => res.json())
      .then(response => {
        // Stop the scanning animation
        scanStatus.classList.remove("scanning");
        scanStatus.classList.add("scan-completed");
        scanStatus.textContent = `Scan Complete (${mode === "deep" ? "Deep Scan" : "Scan"})`;
        scoreBox.classList.remove("scanning");
        document.getElementById("hourglass").textContent = "✅";
        document.getElementById("hourglass").classList.remove("hourglass");

        const fullReply = response.reply || "";
        console.log("🔍 Full GPT response:", fullReply);

        // Extract Tone & Bias if present
        const toneMatch = fullReply.match(/Tone:\s*(.+)/i);
        const biasMatch = fullReply.match(/Bias:\s*(.+)/i);
        toneEl.textContent = `Tone: ${toneMatch ? toneMatch[1].trim() : "–"}`;
        biasEl.textContent = `Bias: ${biasMatch ? biasMatch[1].trim() : "–"}`;

        // Extract the Truth Score from the reply
        const match = fullReply.match(scoreRegex);
        let reasoning = fullReply;
        let score = null;

        if (match) {
          score = parseFloat(match[1]);
          scoreValue.textContent = score.toString();
          // Remove “Truth Score: X” from the reasoning block
          reasoning = fullReply.replace(match[0], "").trim();
        } else {
          scoreValue.textContent = "–";
          scoreText.textContent = "Truth Score not detected";
        }

        // Break out “Summary: …”, “Reasoning: …”, and “References: …” into paragraphs
        const sections = reasoning
          .split(/-\s*(?=Summary:|Reasoning:|References:|Sources:)/gi)
          .filter(Boolean);

        let summaryHTML    = "";
        let reasoningHTML  = "";
        let referencesHTML = "";

        sections.forEach(section => {
          const m = section.match(/^(Summary|Reasoning|References|Sources):\s*(.*)/is);
          if (!m) return;
          const label   = m[1].toLowerCase();
          const content = m[2].trim();

          if (label === "summary") {
            summaryHTML = `<p><strong>Summary:</strong> ${content}</p>`;
          } else if (label === "reasoning") {
            reasoningHTML = `<p><strong>Reasoning:</strong> ${content}</p>`;
          } else {
            const refs = content
              .split(/[\n\r;\u2022]+/)
              .map(r => r.trim())
              .filter(Boolean);

            const bullets = refs
              .map(r => {
                const urlMatch = r.match(/https?:\/\/[^\s)\],]+/i);
                if (urlMatch) {
                  const rawUrl   = urlMatch[0];
                  const cleanUrl = rawUrl.replace(/[).,]+$/, "");
                  const trailing = rawUrl.slice(cleanUrl.length);
                  return `<li><a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trailing}</li>`;
                }
                return `<li>${r}</li>`;
              })
              .join("");
            referencesHTML = `<div><strong>References:</strong><ul>${bullets}</ul></div>`;
          }
        });

        explanationEl.innerHTML = summaryHTML + reasoningHTML + referencesHTML;
        explanationEl.classList.remove("visible");
        explainBtn.style.display = "inline-block";

        // Toggle visibility for the “Show Explanation” button
        let explanationShown = false;
        explainBtn.textContent = "Show Explanation";
        explainBtn.onclick = () => {
          explanationShown = !explanationShown;
          explanationEl.classList.toggle("visible");
          explainBtn.textContent = explanationShown ? "Hide Explanation" : "Show Explanation";
        };

        // Show the static “Why X Score?” button with a brief definition
        const explanationMap = {
          0: "False – No evidence, clearly debunked.",
          1: "Mostly False – Mostly inaccurate, may misuse isolated facts.",
          2: "Probably False – Lacks support from credible sources.",
          3: "Partially True – Mix of true/false, some valid points.",
          4: "Mostly True – Largely accurate with small caveats.",
          5: "Verified True – Fully supported, consistent across trusted sources."
        };

        if (!isNaN(score) && explanationMap[score] !== undefined) {
          whyScoreBtn.style.display = "inline-block";
          scoreExplanationEl.textContent = explanationMap[score];
          scoreExplanationEl.classList.remove("visible");

          let whyShown = false;
          whyScoreBtn.textContent = `Why ${score} Score?`;
          whyScoreBtn.onclick = () => {
            whyShown = !whyShown;
            scoreExplanationEl.classList.toggle("visible");
            whyScoreBtn.textContent = whyShown
              ? "Hide Why Score"
              : `Why ${score} Score?`;
          };
        } else {
          whyScoreBtn.style.display = "none";
          scoreExplanationEl.classList.remove("visible");
        }

        closeBtn.style.display = "block";
      })
      .catch(err => {
        scanStatus.classList.remove("scanning");
        scanStatus.classList.add("scan-completed");
        scanStatus.textContent = "Failed to scan.";
        scoreValue.textContent = "–";
        scoreText.textContent = "Scan failed";
        explanationEl.textContent = "Error: " + err.message;
        explanationEl.classList.add("visible");
        closeBtn.style.display = "block";
      });
  });

  // Close button hides main screen and shows feedback
  closeBtn.addEventListener("click", () => {
    document.querySelector(".screen").style.display = "none";
    document.getElementById("feedbackContainer").classList.remove("hidden");
  });
});
