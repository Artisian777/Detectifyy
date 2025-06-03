// popup.js

const scoreRegex = /truth\s*score\s*[:\-]?\s*(\d(?:\.\d+)?)/i;

document.addEventListener("DOMContentLoaded", () => {
  const scanStatus      = document.getElementById("scanStatus");
  const scoreBox        = document.getElementById("scoreBox");
  const scoreValue      = document.getElementById("scoreValue");
  const scoreText       = document.getElementById("scoreText");
  const closeBtn        = document.getElementById("close");
  const explanationEl   = document.getElementById("explanationText");
  const explainBtn      = document.getElementById("explainBtn");
  const whyScoreBtn     = document.getElementById("whyScoreBtn");
  const scoreExplanationEl = document.getElementById("scoreExplanation");
  const scanModeText    = document.getElementById("scanMode");

  // 1) Retrieve the selected text + mode from chrome.storage
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
- Summary: brief summary of findings
- Reasoning: explain why the score was given and what caveats prevented a higher score.
- References: include URLs or publication names used

Claim: "${text}"`;
    }

    // 2) Show “Scanning...” animation/text
    scanStatus.classList.add("scanning");
    scanStatus.textContent = `Scanning (${mode === "deep" ? "Deep Scan" : "Scan"})...`;

    // 3) Call your external backend rather than directly calling OpenAI
    fetch("https://detectifyy-production.up.railway.app/api/factcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt })
    })
      .then((res) => res.json())
      .then((response) => {
        // Stop the scanning animation
        scanStatus.classList.remove("scanning");
        scanStatus.classList.add("scan-completed");
        scanStatus.textContent = `Scan Complete (${mode === "deep" ? "Deep Scan" : "Scan"})`;
        scoreBox.classList.remove("scanning");

        const fullReply = response.reply || "";
        console.log("🔍 Full GPT response:", fullReply);

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

        let summaryHTML = "", reasoningHTML = "", referencesHTML = "";

        sections.forEach((section) => {
          const m = section.match(/^(Summary|Reasoning|References|Sources):\s*(.*)/is);
          if (!m) return;
          const label = m[1].toLowerCase();
          const content = m[2].trim();

          if (label === "summary") {
            summaryHTML = `<p class="formatted-paragraph"><strong>Summary:</strong> ${content}</p>`;
          } else if (label === "reasoning") {
            reasoningHTML = `<p class="formatted-paragraph"><strong>Reasoning:</strong> ${content}</p>`;
          } else if (label === "references" || label === "sources") {
            // Split references by newline, semicolon, or bullet
            const refs = content
              .split(/[\n\r;•]+/)
              .map((r) => r.trim())
              .filter(Boolean);

            const bullets = refs
              .map((r) => {
                // If we find an http(s) URL, wrap it in <a>
                const urlMatch = r.match(/https?:\/\/[^\s)]+/i);
                if (urlMatch) {
                  const url = urlMatch[0];
                  // Remove any trailing parenthesis if present
                  const cleanUrl = url.replace(/\)+$/, "");
                  return `<li><a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a></li>`;
                } else {
                  return `<li>${r}</li>`;
                }
              })
              .join("");

            referencesHTML = `<div class="formatted-paragraph"><strong>References:</strong><ul>${bullets}</ul></div>`;
          }
        });

        // Insert the formatted HTML into the explanation container
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
      .catch((err) => {
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

  // 4) Close button closes the popup
  closeBtn.addEventListener("click", () => {
    window.close();
  });
});
