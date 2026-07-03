import { useState } from 'react';
import { PortionSlider } from './PortionSlider.jsx';

export default {
  title: 'Components/PortionSlider',
  component: PortionSlider,
  parameters: { backgrounds: { default: 'camera-dark' } },
};

export const Interactive = {
  render: () => {
    const [v, setV] = useState(50);
    return (
      <div style={{ width: 280 }}>
        <PortionSlider value={v} onChange={setV} />
      </div>
    );
  },
};
