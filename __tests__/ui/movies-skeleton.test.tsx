import { render, screen } from '@testing-library/react';
import { MoviesSkeleton } from '@/app/ui/movies-skeleton';

describe('MoviesSkeleton', () => {
  it('renders default 20 skeletons with wrapper grid', () => {
    render(<MoviesSkeleton />);

    // Wrapper grid has role="status" with aria-busy
    const wrapper = screen.getByRole('status', { name: '' });
    expect(wrapper).toHaveAttribute('aria-busy', 'true');

    // Each skeleton also has role="status" with aria-label="Loading"
    const skeletons = screen.getAllByRole('status', { name: 'Loading' });
    expect(skeletons).toHaveLength(20);
  });

  it('renders custom count', () => {
    render(<MoviesSkeleton count={5} />);

    const skeletons = screen.getAllByRole('status', { name: 'Loading' });
    expect(skeletons).toHaveLength(5);
  });

  it('wrapper={false} renders no grid container', () => {
    render(<MoviesSkeleton wrapper={false} />);

    // No wrapper with aria-busy
    const allStatuses = screen.getAllByRole('status');
    allStatuses.forEach((el) => {
      expect(el).not.toHaveAttribute('aria-busy');
    });

    // But individual skeletons should still be present
    const skeletons = screen.getAllByRole('status', { name: 'Loading' });
    expect(skeletons).toHaveLength(20);
  });

  it('snapshot test', () => {
    const { container } = render(<MoviesSkeleton count={3} />);
    expect(container).toMatchSnapshot();
  });
});
