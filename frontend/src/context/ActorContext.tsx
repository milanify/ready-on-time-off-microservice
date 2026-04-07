import React, { createContext, useContext, useState } from 'react';

export type Role = 'employee' | 'manager' | 'admin';

export interface Actor {
  employeeId: string;
  locationId: string;
  role: Role;
  label: string;
}

export const defaultActors: Actor[] = [
  { employeeId: 'emp-456', locationId: 'UK-LON', role: 'employee', label: 'Sarah (Employee)' },
  { employeeId: 'emp-123', locationId: 'US-NY', role: 'employee', label: 'John (Employee)' },
  { employeeId: 'manager-1', locationId: 'UK-LON', role: 'manager', label: 'UK Manager (Manager)' },
  { employeeId: 'admin', locationId: 'GLOBAL', role: 'admin', label: 'System Admin (Admin)' }
];

interface ActorContextType {
  actor: Actor;
  setActor: (actor: Actor) => void;
}

const ActorContext = createContext<ActorContextType>({
  actor: defaultActors[0],
  setActor: () => {}
});

export const ActorProvider = ({ children }: { children: React.ReactNode }) => {
  const [actor, setActor] = useState<Actor>(defaultActors[0]);
  return <ActorContext.Provider value={{ actor, setActor }}>{children}</ActorContext.Provider>;
};

export const useActor = () => useContext(ActorContext);
