import { CampSandbox } from './CampSandbox.jsx';

export default {
  title: 'Core/Sandbox',
  component: CampSandbox,
  render: (args) => <CampSandbox key={`${args.initialPreset ?? 'default'}-${args.initialDevice ?? 'standard'}`} {...args} />,
  parameters: { backgrounds: { default: 'light' }, controls: { disable: true }, layout: 'padded' },
};

export const CampCollage = { name: 'Песочница · лагерь слоями' };
export const OwnerComposition = { name: 'Композиция · по твоей раскладке', args: { initialPreset: 'owner' } };

export const CompactPhone = { name: 'Компактный · 320 × 568', args: { initialDevice: 'compact' } };
export const LargePhone = { name: 'Большой · 430 × 932', args: { initialDevice: 'large' } };
