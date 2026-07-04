import React from 'react';

function Button({ children, className = '', type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={`px-4 py-2 rounded-md border-neutral-300 hover:-translate-y-1 transform transition duration-200 hover:shadow-md ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
