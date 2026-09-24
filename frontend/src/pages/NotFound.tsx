import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => {
  return (
    <section className="card" style={{ textAlign: 'center' }}>
      <div className="card-header">
        <h2>Page Not Found</h2>
      </div>
      <p className="text-secondary" style={{ marginBottom: '1rem' }}>The page you are looking for does not exist.</p>
      <Link to="/" className="btn btn-primary">Return to Home</Link>
    </section>
  );
};

export default NotFound;
