(function () {
  const CustomSwitcher = {
    create(container, options) {
      const { label, value, onChange } = options;

      const switcherWrapper = document.createElement("div");
      switcherWrapper.className = "custom-switcher-wrapper";

      const labelEl = document.createElement("div");
      labelEl.className = "setting-label";
      labelEl.textContent = label;
      switcherWrapper.appendChild(labelEl);

      const switcher = document.createElement("label");
      switcher.className = "switcher";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = value;
      switcher.appendChild(input);

      const slider = document.createElement("span");
      slider.className = "slider round";
      switcher.appendChild(slider);
      
      switcherWrapper.appendChild(switcher);
      container.appendChild(switcherWrapper);

      input.addEventListener("change", () => {
        if (onChange) {
          onChange(input.checked);
        }
      });

      return {
        setValue: (newValue) => {
          input.checked = newValue;
        }
      };
    }
  };

  window.CustomSwitcher = CustomSwitcher;
})();
