import {IInputs, IOutputs} from "./generated/ManifestTypes";

interface Option {
  label: string;
  value: number;
};

export class optionSetWarranty implements ComponentFramework.StandardControl<IInputs, IOutputs> {
  private container!: HTMLDivElement;
  private context!: ComponentFramework.Context<IInputs>;
  private notifyOutputChanged!: () => void;

  private options: Option[] = [];
  private selectedValue: number | null = null;

  private tileWidth = 120;
  private tileHeight = 110;

  private onClickBound!: (e: MouseEvent) => void;
  private onKeydownBound!: (e: KeyboardEvent) => void;

  public init(ctx: ComponentFramework.Context<IInputs>, notify: () => void, state: ComponentFramework.Dictionary, cont: HTMLDivElement): void {
    this.context = ctx;
    this.notifyOutputChanged = notify;
    this.container = cont;
    this.container.classList.add("warranty-root");

    // optional sizing
    //const w = ctx.parameters.tileWidth?.raw;
    //const h = ctx.parameters.tileHeight?.raw;
    //if (typeof w === "number" && w > 60) this.tileWidth = w;
    //if (typeof h === "number" && h > 80) this.tileHeight = h;

    // Read Choice options (OptionSet)
    const opts = ctx.parameters.warranty.attributes?.Options || [];
    this.options = opts.map(o => ({ label: o.Label, value: o.Value }));

    // Selected value from the record
    const raw = ctx.parameters.warranty.raw;
    this.selectedValue = (typeof raw === "number") ? raw : null;

    // Render initial UI
    this.render();

    // Bind handlers once
    this.onClickBound = (e: MouseEvent) => this.handleClick(e);
    this.onKeydownBound = (e: KeyboardEvent) => this.handleKeydown(e);

    this.container.addEventListener("click", this.onClickBound);
    this.container.addEventListener("keydown", this.onKeydownBound);
  }

  public updateView(ctx: ComponentFramework.Context<IInputs>): void {
    this.context = ctx;

    // Keep selection in sync if record changes externally
    const raw = ctx.parameters.warranty.raw;
    const newVal = (typeof raw === "number") ? raw : null;
    if (newVal !== this.selectedValue) {
      this.selectedValue = newVal;
      this.render(); // re-paint classes
    }
  }

  public getOutputs(): IOutputs {
    return { warranty: this.selectedValue as number };
  }

  public destroy(): void {
    this.container.removeEventListener("click", this.onClickBound);
    this.container.removeEventListener("keydown", this.onKeydownBound);
    this.container.innerHTML = "";
  }

  // ---------- UI ----------
  private render(): void {
    // Build tiles
    const tiles = this.options.map(o => this.tileHtml(o)).join("");
    this.container.innerHTML = `
      <div class="warranty-group" role="radiogroup" aria-label="Warranty Type">
        ${tiles}
      </div>
    `;
    // Set focusable on selected or first
    const active = this.container.querySelector<HTMLElement>('[data-role="tile"][aria-checked="true"]')
                ?? this.container.querySelector<HTMLElement>('[data-role="tile"]');
    active?.setAttribute("tabindex", "0");
  }

  private tileHtml(o: Option): string {
    const selected = this.selectedValue === o.value;
    const checked = selected ? "true" : "false";
    const classes = `warranty-tile${selected ? " selected" : ""}`;
    const icon = this.iconFor(o.label); // inline SVG
    return `
      <button type="button"
              class="${classes}"
              style="--tile-w:${this.tileWidth}px;--tile-h:${this.tileHeight}px"
              data-role="tile"
              data-value="${o.value}"
              role="radio"
              aria-checked="${checked}">
        <span class="icon" aria-hidden="true">${icon}</span>
        <span class="text">${o.label}</span>
        <span class="ring" aria-hidden="true"></span>
      </button>
    `;
  }

  // Map label → SVG (feel free to adjust)
  private iconFor(label: string): string {
    const key = label.toLowerCase();
    const stroke = "currentColor";
    const fill = "currentColor";
    if (key.includes("Basic")) {
      return `<svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 2l8 3v6c0 5.25-3.5 9.75-8 11-4.5-1.25-8-5.75-8-11V5l8-3z" fill="none" stroke="${stroke}" stroke-width="1.5"/></svg>`;
    }
    if (key.includes("Extended")) {
      return `<svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 2l8 3v6c0 5.25-3.5 9.75-8 11-4.5-1.25-8-5.75-8-11V5l8-3z" fill="${fill}" opacity="0.85"/></svg>`;
    }
    if (key.includes("Lifetime")) {
      return `<svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 2l8 3v6c0 5.25-3.5 9.75-8 11-4.5-1.25-8-5.75-8-11V5l8-3z" fill="none" stroke="${stroke}" stroke-width="1.5"/><path d="M9.5 12l1.8 1.8 3.2-3.2" stroke="${stroke}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    // default generic shield
    return `<svg viewBox="0 0 24 24" width="28" height="28"><path d="M12 2l8 3v6c0 5.25-3.5 9.75-8 11-4.5-1.25-8-5.75-8-11V5l8-3z" fill="none" stroke="${stroke}" stroke-width="1.5"/></svg>`;
  }

  // ---------- Events ----------
  private handleClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement).closest('[data-role="tile"]') as HTMLElement | null;
    if (!target) return;
    const value = Number(target.getAttribute("data-value"));
    if (Number.isFinite(value) && value !== this.selectedValue) {
      this.selectedValue = value;
      this.render();
      this.notifyOutputChanged();
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    const radios = Array.from(this.container.querySelectorAll<HTMLElement>('[data-role="tile"]'));
    if (radios.length === 0) return;

    const currentIndex = radios.findIndex(el => el.getAttribute("aria-checked") === "true");
    const focusIndex = Math.max(0, currentIndex);
    const key = e.key;

    const move = (offset: number) => {
      e.preventDefault();
      const idx = (focusIndex + offset + radios.length) % radios.length;
      const el = radios[idx];
      el.focus();
      const val = Number(el.getAttribute("data-value"));
      if (val !== this.selectedValue) {
        this.selectedValue = val;
        this.render();
        this.notifyOutputChanged();
        // restore focus after re-render
        const refocus = this.container.querySelector<HTMLElement>(`[data-role="tile"][data-value="${val}"]`);
        refocus?.focus();
      }
    };

    if (key === "ArrowRight" || key === "ArrowDown") move(1);
    else if (key === "ArrowLeft" || key === "ArrowUp") move(-1);
    else if (key === " " || key === "Enter") {
      const el = radios[focusIndex];
      const val = Number(el.getAttribute("data-value"));
      if (val !== this.selectedValue) {
        e.preventDefault();
        this.selectedValue = val;
        this.render();
        this.notifyOutputChanged();
        this.container.querySelector<HTMLElement>(`[data-role="tile"][data-value="${val}"]`)?.focus();
      }
    }
  }
}
