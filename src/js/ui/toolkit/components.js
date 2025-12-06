/**
 * Module Toolkit - Component Factories
 *
 * Provides factory functions for creating standard module UI components:
 * knobs, jacks, switches, LEDs, and button banks.
 */

/**
 * Create a knob element with drag interaction
 * @param {Object} options
 * @param {string} options.id - Unique identifier
 * @param {string} options.label - Display label
 * @param {string} options.moduleId - Parent module ID
 * @param {number} options.value - Current value
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {number} options.step - Step increment (0 for continuous)
 * @param {Function} options.onChange - Callback when value changes
 * @returns {HTMLElement} Knob container element
 */
export function createKnob({
    id,
    label,
    moduleId,
    value = 0.5,
    min = 0,
    max = 1,
    step = 0,
    onChange
}) {
    const container = document.createElement('div');
    container.className = 'knob-container';

    const knob = document.createElement('div');
    knob.className = 'knob';
    knob.id = `knob-${moduleId}-${id}`;
    knob.dataset.module = moduleId;
    knob.dataset.param = id;
    knob.dataset.value = value;
    knob.dataset.min = min;
    knob.dataset.max = max;
    knob.dataset.step = step;

    const labelEl = document.createElement('div');
    labelEl.className = 'knob-label';
    labelEl.textContent = label;

    container.appendChild(knob);
    container.appendChild(labelEl);

    // Set initial rotation
    updateKnobRotation(knob);

    // Set up drag interaction
    setupKnobDrag(knob, onChange);

    return container;
}

/**
 * Create a jack (input/output) element
 * @param {Object} options
 * @param {string} options.id - Port identifier (matches DSP input/output name)
 * @param {string} options.label - Display label
 * @param {string} options.moduleId - Parent module ID
 * @param {string} options.direction - 'input' or 'output'
 * @param {string} options.type - Signal type: 'buffer', 'cv', 'trigger'
 * @returns {HTMLElement} Jack container element
 */
export function createJack({
    id,
    label,
    moduleId,
    direction,
    type = 'buffer'
}) {
    const container = document.createElement('div');
    container.className = 'jack-container';

    const jack = document.createElement('div');
    jack.className = `jack ${direction}`;
    jack.id = `jack-${moduleId}-${id}`;
    jack.dataset.module = moduleId;
    jack.dataset.port = id;
    jack.dataset.dir = direction;
    jack.dataset.type = type;

    const labelEl = document.createElement('div');
    labelEl.className = 'jack-label';
    labelEl.textContent = label;

    container.appendChild(jack);
    container.appendChild(labelEl);

    return container;
}

/**
 * Create a toggle switch element
 * @param {Object} options
 * @param {string} options.id - Unique identifier
 * @param {string} options.label - Display label
 * @param {string} options.moduleId - Parent module ID
 * @param {number} options.value - Initial value (0 or 1)
 * @param {Function} options.onChange - Callback when toggled
 * @returns {HTMLElement} Switch container element
 */
export function createSwitch({
    id,
    label,
    moduleId,
    value = 0,
    onChange
}) {
    const container = document.createElement('div');
    container.className = 'knob-container';

    const sw = document.createElement('div');
    sw.className = `switch ${value ? 'on' : ''}`;
    sw.id = `switch-${moduleId}-${id}`;
    sw.dataset.module = moduleId;
    sw.dataset.param = id;

    sw.addEventListener('click', () => {
        const isOn = sw.classList.toggle('on');
        const newValue = isOn ? 1 : 0;
        onChange?.(newValue);
    });

    const labelEl = document.createElement('div');
    labelEl.className = 'knob-label';
    labelEl.textContent = label;

    container.appendChild(sw);
    container.appendChild(labelEl);

    return container;
}

/**
 * Create an LED indicator element
 * @param {Object} options
 * @param {string} options.id - Unique identifier
 * @param {string} options.moduleId - Parent module ID
 * @param {string} options.color - LED color: 'green', 'red', or custom
 * @returns {HTMLElement} LED element
 */
export function createLED({
    id,
    moduleId,
    color = 'green'
}) {
    const led = document.createElement('div');
    led.className = `led ${color}`;
    led.id = `led-${moduleId}-${id}`;
    led.dataset.module = moduleId;
    led.dataset.led = id;
    return led;
}

/**
 * Create a button bank (e.g., for octave selection)
 * @param {Object} options
 * @param {string} options.id - Unique identifier
 * @param {string} options.label - Section label
 * @param {string} options.moduleId - Parent module ID
 * @param {number[]} options.values - Array of button values
 * @param {number} options.defaultValue - Initially selected value
 * @param {Function} options.onChange - Callback when selection changes
 * @returns {HTMLElement} Button bank container
 */
export function createButtonBank({
    id,
    label,
    moduleId,
    values,
    defaultValue,
    onChange
}) {
    const container = document.createElement('div');

    const labelEl = document.createElement('div');
    labelEl.className = 'section-label';
    labelEl.textContent = label;
    container.appendChild(labelEl);

    const bank = document.createElement('div');
    bank.className = 'button-bank';
    bank.dataset.module = moduleId;
    bank.dataset.param = id;

    values.forEach(val => {
        const btn = document.createElement('button');
        btn.className = `octave-btn ${val === defaultValue ? 'active' : ''}`;
        btn.dataset.value = val;
        btn.textContent = val > 0 ? `+${val}` : String(val);

        btn.addEventListener('click', () => {
            bank.querySelectorAll('.octave-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onChange?.(val);
        });

        bank.appendChild(btn);
    });

    container.appendChild(bank);
    return container;
}

/**
 * Create a canvas for custom visualizations
 * @param {Object} options
 * @param {number} options.width - Canvas width in pixels
 * @param {number} options.height - Canvas height in pixels
 * @param {string} options.className - Additional CSS class
 * @returns {HTMLCanvasElement} Canvas element
 */
export function createCanvas({
    width = 100,
    height = 60,
    className = 'module-canvas'
}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = className;
    return canvas;
}

/**
 * Update knob visual rotation based on its value
 * @param {HTMLElement} knobEl - Knob element
 */
export function updateKnobRotation(knobEl) {
    const min = parseFloat(knobEl.dataset.min);
    const max = parseFloat(knobEl.dataset.max);
    const value = parseFloat(knobEl.dataset.value);
    const rotation = -135 + ((value - min) / (max - min)) * 270;
    knobEl.style.transform = `rotate(${rotation}deg)`;
}

/**
 * Set up drag interaction for a knob
 * @param {HTMLElement} knobEl - Knob element
 * @param {Function} onChange - Callback when value changes
 */
export function setupKnobDrag(knobEl, onChange) {
    let isDragging = false;
    let startY = 0;
    let startValue = 0;

    const onMouseDown = (e) => {
        isDragging = true;
        startY = e.clientY;
        startValue = parseFloat(knobEl.dataset.value);
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;

        const min = parseFloat(knobEl.dataset.min);
        const max = parseFloat(knobEl.dataset.max);
        const step = parseFloat(knobEl.dataset.step) || 0;
        const range = max - min;
        const dy = startY - e.clientY;
        let newValue = startValue + (dy / 150) * range;

        if (step > 0) {
            newValue = Math.round(newValue / step) * step;
        }
        newValue = Math.max(min, Math.min(max, newValue));

        knobEl.dataset.value = newValue;
        updateKnobRotation(knobEl);
        onChange?.(newValue);
    };

    const onMouseUp = () => {
        isDragging = false;
    };

    knobEl.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * Set knob value programmatically
 * @param {HTMLElement} knobEl - Knob element
 * @param {number} value - New value
 */
export function setKnobValue(knobEl, value) {
    const min = parseFloat(knobEl.dataset.min);
    const max = parseFloat(knobEl.dataset.max);
    knobEl.dataset.value = Math.max(min, Math.min(max, value));
    updateKnobRotation(knobEl);
}

/**
 * Get current knob value
 * @param {HTMLElement} knobEl - Knob element
 * @returns {number} Current value
 */
export function getKnobValue(knobEl) {
    return parseFloat(knobEl.dataset.value);
}

/**
 * Update LED state
 * @param {HTMLElement} ledEl - LED element
 * @param {number} value - Intensity (0-1)
 * @param {number} threshold - Activation threshold
 */
export function updateLED(ledEl, value, threshold = 0.1) {
    ledEl.classList.toggle('active', value > threshold);
}

/**
 * Set switch state programmatically
 * @param {HTMLElement} switchEl - Switch element
 * @param {boolean} isOn - Whether switch should be on
 */
export function setSwitchState(switchEl, isOn) {
    switchEl.classList.toggle('on', isOn);
}
