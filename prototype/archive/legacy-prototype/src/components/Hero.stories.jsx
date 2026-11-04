import { Hero } from './Hero.jsx';

export default {
  title: 'Components/Hero',
  component: Hero,
  argTypes: {
    status: { control: 'inline-radio', options: ['idle', 'hungry', 'eating', 'happy'] },
    showBubble: { control: 'boolean' },
  },
  args: { status: 'idle', showBubble: true },
};

export const Idle = { args: { status: 'idle' } };
export const Hungry = { args: { status: 'hungry' } };
export const Eating = { args: { status: 'eating' } };
export const Happy = { args: { status: 'happy' } };

export const AllStates = {
  render: () => (
    <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end' }}>
      <Hero status="hungry" />
      <Hero status="eating" />
      <Hero status="happy" />
    </div>
  ),
};
