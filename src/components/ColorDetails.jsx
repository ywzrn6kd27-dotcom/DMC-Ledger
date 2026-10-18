import { useState } from 'react';
import { useApp } from '../lib/context.js';
import { decorate } from '../lib/catalog.js';
import * as ops from '../lib/ops.js';
import { PENDING_HEX } from '../lib/utils.js';
import { ColorsField, Modal, Swatch, TypeSelect } from './ui.jsx';

// Create or edit a catalog color. Used for codes that are not in the built-in list,
// including multicolor (variegated) skeins.
export default function ColorDetails({ initial, edit = false, onClose, onSaved }) {
  const { update, toast } = useApp();
  const [brand, setBrand] = useState(initial?.brand || 'DMC');
  const [code, setCode] = useState(initial?.code || '');
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'solid');
  const [colors, setColors] = useState(initial?.colors?.length > 1 ? initial.colors : [initial?.pending ? '#808080' : initial?.hex || '#808080']);

  const save = () => {
    if (!code.trim()) return toast('Enter a code.', 'bad');
    const cols = type === 'variegated' ? (colors.length > 1 ? colors : [colors[0], colors[0]]) : [colors[0]];
    const color = { brand, code: code.trim(), name, hex: cols[0], type, colors: type === 'variegated' ? cols : [] };
    update((s) => ops.saveCustomColor(s, color));
    toast(`Saved ${color.code}`);
    onSaved?.(decorate({ ...color, custom: true }));
    onClose();
  };

  return (
    <Modal
      title={edit ? 'Edit color details' : 'New color'}
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save color</button></>}
    >
      <div className="row"><Swatch hex={colors[0]} colors={type === 'variegated' ? colors : []} size={44} w={72} /><p className="muted small grow">This is saved in your own catalog. You can change it any time from the supply screen or Data.</p></div>
      <div className="field-grid">
        <div className="field"><label htmlFor="cd-brand">Brand</label><input id="cd-brand" className="input" value={brand} disabled={edit} onChange={(e) => setBrand(e.target.value)} /></div>
        <div className="field"><label htmlFor="cd-code">Code</label><input id="cd-code" className="input" value={code} disabled={edit} autoCapitalize="characters" onChange={(e) => setCode(e.target.value)} /></div>
      </div>
      <div className="field"><label htmlFor="cd-name">Name (optional)</label><input id="cd-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Autumn Leaves" /></div>
      <div className="field"><label htmlFor="cd-type">Thread type</label><TypeSelect id="cd-type" value={type} onChange={setType} /></div>
      <div className="field">
        <label>{type === 'variegated' ? 'Colors in the skein (2 to 5)' : 'Color'}</label>
        <ColorsField type={type} colors={colors} onChange={setColors} />
      </div>
    </Modal>
  );
}

export const placeholderColor = (code) => ({ brand: 'DMC', code, name: '', hex: PENDING_HEX, type: 'solid', colors: [], pending: true });
