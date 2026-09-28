(() => {
  const form = document.getElementById("aiResearchForm");
  if (!form) return;
  const input = document.getElementById("aiQuestion");
  const result = document.getElementById("aiResearchResult");
  const button = document.getElementById("aiResearchButton");
  const suggestions = document.querySelectorAll("[data-ai-question]");

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function format(text) {
    return esc(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/^### (.*)$/gm, "<h4>$1</h4>")
      .replace(/^## (.*)$/gm, "<h3>$1</h3>")
      .replace(/^# (.*)$/gm, "<h3>$1</h3>")
      .replace(/\n/g, "<br>");
  }

  suggestions.forEach(item => item.addEventListener("click", () => {
    input.value = item.dataset.aiQuestion || "";
    input.focus();
  }));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    button.disabled = true;
    button.textContent = "Pesquisando…";
    result.hidden = false;
    result.className = "ai-research-result loading";
    result.innerHTML = "<span>🔎</span><div>Pesquisando fontes atuais na web…</div>";

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({question})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível pesquisar.");
      result.className = "ai-research-result";
      result.innerHTML = "<div class=\"ai-answer\">" + format(data.answer) + "</div>";
    } catch (error) {
      result.className = "ai-research-result error";
      result.innerHTML = "<strong>Pesquisa indisponível</strong><p>" + esc(error.message) + "</p><small>Verifique se OPENAI_API_KEY está configurada no servidor.</small>";
    } finally {
      button.disabled = false;
      button.textContent = "Pesquisar";
    }
  });
})();
