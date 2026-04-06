import React from 'react';
import { BalanceView } from './components/BalanceView';
import { RequestForm } from './components/RequestForm';

function App() {
  return (
    <div>
      <h1>ReadyOn Time-Off</h1>
      <BalanceView />
      <RequestForm />
    </div>
  );
}

export default App;