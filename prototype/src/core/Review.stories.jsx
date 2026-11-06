import { ProductReview } from './ProductReview.jsx';

export default {
  title: 'Ревью',
  id: 'product-review',
  parameters: { layout: 'fullscreen', controls: { disable: true } },
};

export const Walkthrough = {
  name: 'Один день вместе',
  render: () => <ProductReview />,
};
