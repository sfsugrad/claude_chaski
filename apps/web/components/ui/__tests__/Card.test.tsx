import { render, screen, fireEvent } from '@testing-library/react';
import { Card, CardHeader, CardBody, CardFooter } from '../Card';

describe('Card Component', () => {
  describe('Rendering', () => {
    it('renders with default props', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(<Card>Test card content</Card>);
      expect(screen.getByText('Test card content')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(<Card ref={ref}>Card</Card>);
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Padding', () => {
    it('has no padding by default', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveClass('p-4');
      expect(card).not.toHaveClass('p-6');
      expect(card).not.toHaveClass('p-8');
    });

    it('renders with no padding when padding="none"', () => {
      const { container } = render(<Card padding="none">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveClass('p-4');
      expect(card).not.toHaveClass('p-6');
      expect(card).not.toHaveClass('p-8');
    });

    it('renders with small padding', () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('p-4');
    });

    it('renders with medium padding', () => {
      const { container } = render(<Card padding="md">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('p-6');
    });

    it('renders with large padding', () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('p-8');
    });
  });

  describe('Hoverable', () => {
    it('is not hoverable by default', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).not.toHaveClass('hover:shadow-card-hover');
      expect(card).not.toHaveClass('cursor-pointer');
    });

    it('applies hover classes when hoverable is true', () => {
      const { container } = render(<Card hoverable>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('hover:shadow-card-hover');
      expect(card).toHaveClass('hover:border-surface-300');
      expect(card).toHaveClass('hover:-translate-y-1');
      expect(card).toHaveClass('cursor-pointer');
    });

    it('applies active state classes when hoverable', () => {
      const { container } = render(<Card hoverable>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('active:translate-y-0');
      expect(card).toHaveClass('active:scale-[0.99]');
    });

    it('can be clicked when hoverable', () => {
      const onClick = jest.fn();
      const { container } = render(
        <Card hoverable onClick={onClick}>
          Content
        </Card>
      );
      const card = container.firstChild as HTMLElement;
      fireEvent.click(card);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Base Styling', () => {
    it('has background color', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-white');
    });

    it('has rounded corners', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('rounded-xl');
    });

    it('has border', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('border', 'border-surface-200');
    });

    it('has shadow', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('shadow-card');
    });

    it('has transition classes', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('transition-all', 'duration-200', 'ease-out');
    });

    it('has transform class', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('transform-gpu');
    });
  });

  describe('Custom Classes', () => {
    it('applies custom className', () => {
      const { container } = render(<Card className="custom-card">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('custom-card');
    });

    it('merges custom className with default classes', () => {
      const { container } = render(<Card className="custom-card">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('custom-card');
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('rounded-xl');
    });
  });

  describe('HTML Attributes', () => {
    it('accepts and applies data attributes', () => {
      render(<Card data-testid="custom-card">Content</Card>);
      expect(screen.getByTestId('custom-card')).toBeInTheDocument();
    });

    it('accepts and applies other HTML attributes', () => {
      const { container } = render(<Card id="card-1">Content</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveAttribute('id', 'card-1');
    });
  });
});

describe('CardHeader Component', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(
        <Card>
          <CardHeader>
            <div>Custom header content</div>
          </CardHeader>
        </Card>
      );
      expect(screen.getByText('Custom header content')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(
        <Card>
          <CardHeader ref={ref}>Header</CardHeader>
        </Card>
      );
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Title and Subtitle', () => {
    it('renders title when provided', () => {
      render(
        <Card>
          <CardHeader title="Card Title" />
        </Card>
      );
      expect(screen.getByText('Card Title')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <Card>
          <CardHeader subtitle="Card subtitle" />
        </Card>
      );
      expect(screen.getByText('Card subtitle')).toBeInTheDocument();
    });

    it('renders both title and subtitle', () => {
      render(
        <Card>
          <CardHeader title="Title" subtitle="Subtitle" />
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Subtitle')).toBeInTheDocument();
    });

    it('title has correct class', () => {
      render(
        <Card>
          <CardHeader title="Title" />
        </Card>
      );
      const title = screen.getByText('Title');
      expect(title).toHaveClass('card-title');
    });

    it('subtitle has correct styling', () => {
      render(
        <Card>
          <CardHeader subtitle="Subtitle" />
        </Card>
      );
      const subtitle = screen.getByText('Subtitle');
      expect(subtitle).toHaveClass('text-sm', 'text-surface-500', 'mt-0.5');
    });
  });

  describe('Action', () => {
    it('renders action element when provided', () => {
      render(
        <Card>
          <CardHeader
            title="Title"
            action={<button>Action</button>}
          />
        </Card>
      );
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('renders title and action together', () => {
      render(
        <Card>
          <CardHeader
            title="Card Title"
            action={<button>Edit</button>}
          />
        </Card>
      );
      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('renders all three props together', () => {
      render(
        <Card>
          <CardHeader
            title="Title"
            subtitle="Subtitle"
            action={<button>Action</button>}
          />
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Subtitle')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });
  });

  describe('Custom Children', () => {
    it('renders custom children when no title/subtitle/action', () => {
      render(
        <Card>
          <CardHeader>
            <div>Custom header</div>
          </CardHeader>
        </Card>
      );
      expect(screen.getByText('Custom header')).toBeInTheDocument();
    });

    it('ignores children when title is provided', () => {
      render(
        <Card>
          <CardHeader title="Title">
            <div>This should not render</div>
          </CardHeader>
        </Card>
      );
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.queryByText('This should not render')).not.toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('has padding and border classes', () => {
      const { container } = render(
        <Card>
          <CardHeader title="Title" />
        </Card>
      );
      const header = container.querySelector('.px-6.py-4.border-b');
      expect(header).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <Card>
          <CardHeader title="Title" className="custom-header" />
        </Card>
      );
      const header = container.querySelector('.custom-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('px-6', 'py-4');
    });
  });
});

describe('CardBody Component', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(
        <Card>
          <CardBody>Body content</CardBody>
        </Card>
      );
      expect(screen.getByText('Body content')).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(
        <Card>
          <CardBody ref={ref}>Body</CardBody>
        </Card>
      );
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('has padding class', () => {
      const { container } = render(
        <Card>
          <CardBody>Content</CardBody>
        </Card>
      );
      const body = container.querySelector('.p-6');
      expect(body).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <Card>
          <CardBody className="custom-body">Content</CardBody>
        </Card>
      );
      const body = container.querySelector('.custom-body');
      expect(body).toBeInTheDocument();
      expect(body).toHaveClass('p-6');
    });
  });
});

describe('CardFooter Component', () => {
  describe('Rendering', () => {
    it('renders children correctly', () => {
      render(
        <Card>
          <CardFooter>
            <button>Cancel</button>
            <button>Submit</button>
          </CardFooter>
        </Card>
      );
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('forwards ref correctly', () => {
      const ref = jest.fn();
      render(
        <Card>
          <CardFooter ref={ref}>Footer</CardFooter>
        </Card>
      );
      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('has background and border classes', () => {
      const { container } = render(
        <Card>
          <CardFooter>Content</CardFooter>
        </Card>
      );
      const footer = container.querySelector('.bg-surface-50.border-t');
      expect(footer).toBeInTheDocument();
    });

    it('has padding and rounded classes', () => {
      const { container } = render(
        <Card>
          <CardFooter>Content</CardFooter>
        </Card>
      );
      const footer = container.querySelector('.px-6.py-4.rounded-b-xl');
      expect(footer).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <Card>
          <CardFooter className="custom-footer">Content</CardFooter>
        </Card>
      );
      const footer = container.querySelector('.custom-footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveClass('px-6', 'py-4');
    });
  });
});

describe('Card Complete Example', () => {
  it('renders complete card with all compound components', () => {
    const handleEdit = jest.fn();
    const handleSubmit = jest.fn();

    render(
      <Card hoverable padding="none">
        <CardHeader
          title="Package Details"
          subtitle="View and manage package information"
          action={<button onClick={handleEdit}>Edit</button>}
        />
        <CardBody>
          <p>Package content and details go here.</p>
        </CardBody>
        <CardFooter>
          <button onClick={handleSubmit}>Submit</button>
        </CardFooter>
      </Card>
    );

    // Check header
    expect(screen.getByText('Package Details')).toBeInTheDocument();
    expect(screen.getByText('View and manage package information')).toBeInTheDocument();

    // Check action button
    const editButton = screen.getByRole('button', { name: 'Edit' });
    expect(editButton).toBeInTheDocument();
    fireEvent.click(editButton);
    expect(handleEdit).toHaveBeenCalledTimes(1);

    // Check body
    expect(screen.getByText('Package content and details go here.')).toBeInTheDocument();

    // Check footer
    const submitButton = screen.getByRole('button', { name: 'Submit' });
    expect(submitButton).toBeInTheDocument();
    fireEvent.click(submitButton);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('renders minimal card with just body', () => {
    render(
      <Card padding="md">
        <CardBody>Simple card content</CardBody>
      </Card>
    );

    expect(screen.getByText('Simple card content')).toBeInTheDocument();
  });

  it('renders card with header and body only', () => {
    render(
      <Card>
        <CardHeader title="Statistics" />
        <CardBody>Statistical data here</CardBody>
      </Card>
    );

    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('Statistical data here')).toBeInTheDocument();
  });

  it('renders clickable card with hover effects', () => {
    const handleClick = jest.fn();

    const { container } = render(
      <Card hoverable onClick={handleClick}>
        <CardBody>Clickable card</CardBody>
      </Card>
    );

    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('cursor-pointer');

    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
