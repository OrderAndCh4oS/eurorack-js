import { getNestedValue, setNestedValue } from '../utils/nested-access.js';

export const MAX_HP_PER_ROW = 84;

export function createDefaultParams(definition) {
    const params = {};
    const ui = definition.ui || {};

    (ui.knobs || []).forEach(knob => {
        params[knob.param] = knob.default;
    });

    (ui.switches || []).forEach(sw => {
        params[sw.param] = sw.default ? 1 : 0;
    });

    (ui.buttons || []).forEach(button => {
        params[button.param] = button.default ?? 0;
    });

    (ui.actions || []).forEach(action => {
        params[action.param] = action.default ?? 0;
    });

    return params;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function createRows(rowCount) {
    const rows = {};
    for (let row = 1; row <= rowCount; row += 1) {
        rows[row] = [];
    }
    return rows;
}

export class RackState {
    constructor({ maxHPPerRow = MAX_HP_PER_ROW, rowCount = 2, minRows = 1 } = {}) {
        this.maxHPPerRow = maxHPPerRow;
        this.defaultRowCount = Math.max(minRows, rowCount);
        this.minRows = minRows;
        this.modules = new Map();
        this.rows = createRows(this.defaultRowCount);
        this.cables = [];
        this.midiMappings = {};
        this.instanceCounters = {};
    }

    getModule(id) {
        return this.modules.get(id) || null;
    }

    getModules() {
        return [...this.modules.values()].map(mod => ({ ...mod, params: clone(mod.params) }));
    }

    getRow(row) {
        return [...(this.rows[row] || [])];
    }

    getRowNumbers() {
        return Object.keys(this.rows)
            .map(row => parseInt(row, 10))
            .filter(Number.isFinite)
            .sort((a, b) => a - b);
    }

    getRowCount() {
        return this.getRowNumbers().length;
    }

    ensureRowCount(rowCount) {
        const nextCount = Math.max(this.minRows, rowCount);
        for (let row = 1; row <= nextCount; row += 1) {
            if (!this.rows[row]) this.rows[row] = [];
        }
    }

    getRowHP(row, registry) {
        return (this.rows[row] || []).reduce((sum, id) => {
            const mod = this.modules.get(id);
            const def = mod ? registry.get(mod.type) : null;
            return sum + (def?.hp || 0);
        }, 0);
    }

    generateInstanceId(type) {
        this.instanceCounters[type] = (this.instanceCounters[type] || 0) + 1;
        return `${type}_${this.instanceCounters[type]}`;
    }

    reserveInstanceId(id, type) {
        const match = id.match(new RegExp(`^${type}_(\\d+)$`));
        if (match) {
            this.instanceCounters[type] = Math.max(this.instanceCounters[type] || 0, parseInt(match[1], 10));
        } else {
            this.instanceCounters[type] = Math.max(this.instanceCounters[type] || 0, 1);
        }
    }

    findFirstFittingRow(definition, registry) {
        const fittingRow = this.getRowNumbers().find(row =>
            this.getRowHP(row, registry) + definition.hp <= this.maxHPPerRow
        );
        if (fittingRow) return fittingRow;
        return null;
    }

    addRow() {
        const rowNumbers = this.getRowNumbers();
        const row = (rowNumbers[rowNumbers.length - 1] || 0) + 1;
        this.rows[row] = [];
        return row;
    }

    removeRow(row = null) {
        const rowNumbers = this.getRowNumbers();
        if (rowNumbers.length <= this.minRows) {
            throw new Error('Cannot remove the last rack row');
        }

        const targetRow = row ?? rowNumbers[rowNumbers.length - 1];
        if (!this.rows[targetRow]) {
            throw new Error(`Invalid rack row: ${targetRow}`);
        }

        const removedModuleIds = new Set(this.rows[targetRow]);
        removedModuleIds.forEach(id => this.modules.delete(id));
        this.cables = this.cables.filter(cable =>
            !removedModuleIds.has(cable.fromModule) && !removedModuleIds.has(cable.toModule)
        );

        const nextRows = {};
        this.getRowNumbers().forEach(currentRow => {
            if (currentRow < targetRow) {
                nextRows[currentRow] = this.rows[currentRow];
            } else if (currentRow > targetRow) {
                const nextRow = currentRow - 1;
                nextRows[nextRow] = this.rows[currentRow];
                nextRows[nextRow].forEach(id => {
                    const mod = this.modules.get(id);
                    if (mod) mod.row = nextRow;
                });
            }
        });

        this.rows = nextRows;
        return { row: targetRow, removedModuleIds: [...removedModuleIds] };
    }

    addModule(type, registry, { row = null, index = null, id = null, params = null } = {}) {
        const definition = registry.get(type);
        if (!definition) {
            throw new Error(`Module type "${type}" not found`);
        }

        const targetRow = row || this.findFirstFittingRow(definition, registry);
        if (!targetRow || !this.rows[targetRow]) {
            throw new Error(`Invalid rack row: ${targetRow}`);
        }

        if (this.getRowHP(targetRow, registry) + definition.hp > this.maxHPPerRow) {
            throw new Error(`Module "${type}" does not fit in row ${targetRow}`);
        }

        const moduleId = id || this.generateInstanceId(type);
        if (this.modules.has(moduleId)) {
            throw new Error(`Module instance "${moduleId}" already exists`);
        }

        if (id) {
            this.reserveInstanceId(id, type);
        }

        const rowModules = this.rows[targetRow];
        const insertIndex = index === null || index === undefined
            ? rowModules.length
            : Math.max(0, Math.min(index, rowModules.length));

        const moduleState = {
            id: moduleId,
            type,
            row: targetRow,
            params: { ...createDefaultParams(definition), ...(params || {}) }
        };

        this.modules.set(moduleId, moduleState);
        rowModules.splice(insertIndex, 0, moduleId);
        return moduleState;
    }

    removeModule(id) {
        const mod = this.modules.get(id);
        if (!mod) return null;

        this.rows[mod.row] = this.rows[mod.row].filter(moduleId => moduleId !== id);
        this.modules.delete(id);
        this.cables = this.cables.filter(cable => cable.fromModule !== id && cable.toModule !== id);
        return mod;
    }

    moveModule(id, registry, { row, index = null }) {
        const mod = this.modules.get(id);
        if (!mod) {
            throw new Error(`Module instance "${id}" not found`);
        }

        const targetRow = row || mod.row;
        if (!this.rows[targetRow]) {
            throw new Error(`Invalid rack row: ${targetRow}`);
        }

        const definition = registry.get(mod.type);
        const currentRow = mod.row;
        this.rows[currentRow] = this.rows[currentRow].filter(moduleId => moduleId !== id);

        try {
            if (targetRow !== currentRow && this.getRowHP(targetRow, registry) + definition.hp > this.maxHPPerRow) {
                throw new Error(`Module "${id}" does not fit in row ${targetRow}`);
            }

            const rowModules = this.rows[targetRow];
            const insertIndex = index === null || index === undefined
                ? rowModules.length
                : Math.max(0, Math.min(index, rowModules.length));

            mod.row = targetRow;
            rowModules.splice(insertIndex, 0, id);
        } catch (error) {
            this.rows[currentRow].push(id);
            mod.row = currentRow;
            throw error;
        }

        return mod;
    }

    setParam(moduleId, paramPath, value) {
        const mod = this.modules.get(moduleId);
        if (!mod) return false;
        setNestedValue(mod.params, paramPath, value);
        return true;
    }

    getParam(moduleId, paramPath) {
        const mod = this.modules.get(moduleId);
        return mod ? getNestedValue(mod.params, paramPath) : undefined;
    }

    connect({ fromModule, fromPort, toModule, toPort }, { replaceInput = true } = {}) {
        if (!this.modules.has(fromModule) || !this.modules.has(toModule)) {
            return null;
        }

        if (replaceInput) {
            this.cables = this.cables.filter(cable => !(cable.toModule === toModule && cable.toPort === toPort));
        }

        const cable = { fromModule, fromPort, toModule, toPort };
        this.cables.push(cable);
        return cable;
    }

    removeCable(match) {
        const before = this.cables.length;
        this.cables = this.cables.filter(cable => cable !== match && !(
            cable.fromModule === match.fromModule &&
            cable.fromPort === match.fromPort &&
            cable.toModule === match.toModule &&
            cable.toPort === match.toPort
        ));
        return before !== this.cables.length;
    }

    clearCables() {
        this.cables = [];
    }

    clear({ rowCount = this.defaultRowCount } = {}) {
        this.modules.clear();
        this.rows = createRows(Math.max(this.minRows, rowCount));
        this.cables = [];
        this.midiMappings = {};
        this.instanceCounters = {};
    }

    loadPatch(patchState, registry) {
        const maxPatchRow = (patchState.modules || []).reduce((maxRow, mod) => {
            const row = Number.isInteger(mod.row) ? mod.row : 1;
            return Math.max(maxRow, row);
        }, this.defaultRowCount);
        this.clear({ rowCount: maxPatchRow });

        (patchState.modules || []).forEach((mod, index) => {
            this.addModule(mod.type, registry, {
                id: mod.id,
                row: mod.row,
                index: mod.index ?? index,
                params: patchState.params?.[mod.id] || {}
            });
        });

        this.cables = (patchState.cables || []).filter(cable =>
            this.modules.has(cable.fromModule) && this.modules.has(cable.toModule)
        ).map(cable => ({ ...cable }));

        this.midiMappings = { ...(patchState.midiMappings || {}) };
    }

    serializePatch() {
        const modules = [];
        this.getRowNumbers().forEach(row => {
            this.rows[row].forEach((id, index) => {
                const mod = this.modules.get(id);
                if (mod) {
                    modules.push({ id, type: mod.type, row, index });
                }
            });
        });

        const params = {};
        this.modules.forEach((mod, id) => {
            params[id] = clone(mod.params);
        });

        return {
            version: 2,
            modules,
            params,
            cables: this.cables.map(cable => ({ ...cable })),
            midiMappings: { ...this.midiMappings }
        };
    }
}
