(function () {
  const AboutPanel = {
    init() {
      this.categoryButtons = document.querySelectorAll(".about-cat-btn");
      this.aboutSections = document.querySelectorAll(".about-section");
      this.bindEvents();
    },

    bindEvents() {
      this.categoryButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.categoryButtons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          const target = btn.getAttribute("data-target");
          this.aboutSections.forEach((sec) => {
            sec.classList.toggle("hidden", sec.id !== target);
          });
        });
      });
    }
  };

  window.AboutPanel = AboutPanel;
  window.addEventListener("DOMContentLoaded", () => {
    AboutPanel.init();
  });
})();
