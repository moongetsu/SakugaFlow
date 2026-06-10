(function () {
  const Dropdown = {
    create(container, options) {
      if (!container) return null;

      const state = {
        items: options.items || [],
        selectedValue: options.selected || (options.items.length ? options.items[0].value : ""),
        onChange: options.onChange || function () {},
        isOpen: false
      };

      container.innerHTML = "";
      container.className = container.className + " custom-dropdown";

      var trigger = document.createElement("button");
      trigger.className = "custom-dropdown-trigger";
      trigger.type = "button";

      var triggerLabel = document.createElement("span");
      triggerLabel.className = "custom-dropdown-label";

      var arrow = document.createElement("span");
      arrow.className = "custom-dropdown-arrow";
      arrow.innerHTML = '<svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';

      trigger.appendChild(triggerLabel);
      trigger.appendChild(arrow);

      var menu = document.createElement("div");
      menu.className = "custom-dropdown-menu hidden";

      var getSelectedItem = function () {
        for (var i = 0; i < state.items.length; i++) {
          if (state.items[i].value === state.selectedValue) return state.items[i];
        }
        return state.items[0] || null;
      };

      var updateTrigger = function () {
        var item = getSelectedItem();
        triggerLabel.textContent = item ? item.label : "";
      };

      var renderItems = function () {
        menu.innerHTML = "";
        for (var i = 0; i < state.items.length; i++) {
          var item = state.items[i];
          var option = document.createElement("div");
          option.className = "custom-dropdown-option" + (item.value === state.selectedValue ? " selected" : "");
          option.textContent = item.label;
          option.dataset.value = item.value;

          option.addEventListener("mousedown", (function (val) {
            return function (e) {
              e.preventDefault();
              e.stopPropagation();
              select(val);
            };
          })(item.value));

          menu.appendChild(option);
        }
      };

      var select = function (value) {
        if (state.selectedValue === value) {
          close();
          return;
        }
        state.selectedValue = value;
        updateTrigger();
        renderItems();
        close();
        state.onChange(value);
      };

      var open = function () {
        state.isOpen = true;
        menu.classList.remove("hidden");
        trigger.classList.add("open");
        document.addEventListener("click", onOutsideClick, true);
      };

      var close = function () {
        state.isOpen = false;
        menu.classList.add("hidden");
        trigger.classList.remove("open");
        document.removeEventListener("click", onOutsideClick, true);
      };

      var onOutsideClick = function (e) {
        if (!container.contains(e.target)) {
          close();
        }
      };

      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (state.isOpen) {
          close();
        } else {
          open();
        }
      });

      trigger.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
          e.preventDefault();
          if (!state.isOpen) open();
          return;
        }
        if (e.key === "Escape") {
          if (state.isOpen) {
            e.preventDefault();
            close();
            trigger.focus();
          }
          return;
        }
        if (e.key === "Enter") {
          if (state.isOpen) {
            e.preventDefault();
            close();
            trigger.focus();
          }
          return;
        }
      });

      container.appendChild(trigger);
      container.appendChild(menu);
      updateTrigger();
      renderItems();

      return {
        getValue: function () { return state.selectedValue; },
        setValue: function (value) {
          state.selectedValue = value;
          updateTrigger();
          renderItems();
        },
        open: open,
        close: close
      };
    }
  };

  window.Dropdown = Dropdown;
})();
