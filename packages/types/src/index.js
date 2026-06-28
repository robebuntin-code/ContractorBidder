"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_TYPE_LABELS = exports.WORK_TYPES = void 0;
exports.formatWorkType = formatWorkType;
exports.WORK_TYPES = [
    'electrical',
    'plumbing',
    'landscaping',
    'hauling',
    'carpentry',
    'handyman',
    'remodeling',
    'painting',
    'heating_ac',
    'other',
];
exports.WORK_TYPE_LABELS = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    landscaping: 'Landscaping',
    hauling: 'Hauling',
    carpentry: 'Carpentry',
    handyman: 'Handyman',
    remodeling: 'Remodeling',
    painting: 'Painting',
    heating_ac: 'Heating/AC',
    other: 'Other',
};
function formatWorkType(value) {
    return exports.WORK_TYPE_LABELS[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
//# sourceMappingURL=index.js.map