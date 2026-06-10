(function () {
  const CustomSlider = {
    create(container, options) {
      const { label, min, max, step, value, unit, onChange } = options;

      const sliderWrapper = document.createElement("div");
      sliderWrapper.className = "custom-slider-wrapper";

      const labelEl = document.createElement("div");
      labelEl.className = "setting-label";
      labelEl.textContent = label;
      sliderWrapper.appendChild(labelEl);

      const sliderRow = document.createElement("div");
      sliderRow.className = "slider-row";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = min;
      slider.max = max;
      slider.step = step;
      slider.value = value;
      sliderRow.appendChild(slider);

      const valueEl = document.createElement("span");
      valueEl.className = "slider-value";
      valueEl.textContent = `${value}${unit || ''}`;
      sliderRow.appendChild(valueEl);
      
      sliderWrapper.appendChild(sliderRow);
      container.appendChild(sliderWrapper);

      const updateSliderStyle = (val) => {
        const percentage = ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, var(--accent-color) ${percentage}%, var(--bg-tertiary) ${percentage}%)`;
      };

      slider.addEventListener("input", () => {
        const newValue = slider.value;
        valueEl.textContent = `${newValue}${unit || ''}`;
        updateSliderStyle(newValue);
        if (onChange) {
          onChange(newValue);
        }
      });

      updateSliderStyle(value);

      return {
        setValue: (newValue) => {
          slider.value = newValue;
          valueEl.textContent = `${newValue}${unit || ''}`;
          updateSliderStyle(newValue);
        }
      };
    }
  };

  window.CustomSlider = CustomSlider;
})();
