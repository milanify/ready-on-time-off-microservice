import React from 'react';

export const RequestForm = () => {
  return (
    <form>
      <input placeholder="Employee ID" />
      <input placeholder="Location ID" />
      <input type="number" placeholder="Days" />
      <button>Request Time Off</button>
    </form>
  );
};