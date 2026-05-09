"use client";
import { useCallback, useEffect, useState } from "react";
import type { Team, TeamMember, Target } from "../types";

function mkTarget(id: string, type: Target["type"], label: string, value: number, current: number, assigned_to: string, assigned_type: "team" | "individual"): Target {
  return { id, type, label, value, current, period: "monthly", assigned_to, assigned_type };
}

const MOCK_MEMBERS: TeamMember[] = [
  { id: "m1", team_id: "tm1", name: "Alex Kumar",    email: "alex@vividview.com",   avatar_initials: "AK", role: "manager",    performance_score: 94, territories: ["Hyderabad","Bangalore"], calls_made: 142, emails_sent: 310, meetings_booked: 28, deals_closed: 12, revenue_generated: 8_40_000, rank: 1, targets: [mkTarget("t1a","revenue","Revenue",10_00_000,8_40_000,"m1","individual"),mkTarget("t1b","calls","Calls",150,142,"m1","individual"),mkTarget("t1c","closures","Closures",15,12,"m1","individual")] },
  { id: "m2", team_id: "tm1", name: "Priya Singh",   email: "priya@vividview.com",  avatar_initials: "PS", role: "senior_rep", performance_score: 88, territories: ["Hyderabad"],               calls_made: 128, emails_sent: 245, meetings_booked: 22, deals_closed: 9,  revenue_generated: 6_20_000, rank: 2, targets: [mkTarget("t2a","revenue","Revenue",8_00_000,6_20_000,"m2","individual"),mkTarget("t2b","calls","Calls",130,128,"m2","individual"),mkTarget("t2c","closures","Closures",10,9,"m2","individual")] },
  { id: "m3", team_id: "tm1", name: "Rahul Nair",    email: "rahul@vividview.com",  avatar_initials: "RN", role: "rep",        performance_score: 76, territories: ["Bangalore"],                calls_made: 98,  emails_sent: 188, meetings_booked: 15, deals_closed: 6,  revenue_generated: 4_10_000, rank: 4, targets: [mkTarget("t3a","revenue","Revenue",6_00_000,4_10_000,"m3","individual"),mkTarget("t3b","calls","Calls",120,98,"m3","individual"),mkTarget("t3c","closures","Closures",8,6,"m3","individual")] },
  { id: "m4", team_id: "tm2", name: "Meera Joshi",   email: "meera@vividview.com",  avatar_initials: "MJ", role: "senior_rep", performance_score: 91, territories: ["Mumbai"],                   calls_made: 135, emails_sent: 290, meetings_booked: 25, deals_closed: 11, revenue_generated: 7_80_000, rank: 3, targets: [mkTarget("t4a","revenue","Revenue",9_00_000,7_80_000,"m4","individual"),mkTarget("t4b","calls","Calls",140,135,"m4","individual"),mkTarget("t4c","closures","Closures",12,11,"m4","individual")] },
  { id: "m5", team_id: "tm2", name: "Sanjay Patel",  email: "sanjay@vividview.com", avatar_initials: "SP", role: "rep",        performance_score: 72, territories: ["Mumbai"],                   calls_made: 89,  emails_sent: 167, meetings_booked: 12, deals_closed: 5,  revenue_generated: 3_60_000, rank: 6, targets: [mkTarget("t5a","revenue","Revenue",6_00_000,3_60_000,"m5","individual"),mkTarget("t5b","calls","Calls",110,89,"m5","individual"),mkTarget("t5c","closures","Closures",7,5,"m5","individual")] },
  { id: "m6", team_id: "tm2", name: "Divya Menon",   email: "divya@vividview.com",  avatar_initials: "DM", role: "rep",        performance_score: 68, territories: ["Chennai"],                  calls_made: 76,  emails_sent: 142, meetings_booked: 10, deals_closed: 4,  revenue_generated: 2_90_000, rank: 7, targets: [mkTarget("t6a","revenue","Revenue",5_00_000,2_90_000,"m6","individual"),mkTarget("t6b","calls","Calls",100,76,"m6","individual"),mkTarget("t6c","closures","Closures",6,4,"m6","individual")] },
  { id: "m7", team_id: "tm3", name: "Arjun Sharma",  email: "arjun@vividview.com",  avatar_initials: "AS", role: "manager",    performance_score: 85, territories: ["Delhi NCR"],                calls_made: 118, emails_sent: 224, meetings_booked: 20, deals_closed: 8,  revenue_generated: 5_80_000, rank: 5, targets: [mkTarget("t7a","revenue","Revenue",8_00_000,5_80_000,"m7","individual"),mkTarget("t7b","calls","Calls",130,118,"m7","individual"),mkTarget("t7c","closures","Closures",10,8,"m7","individual")] },
  { id: "m8", team_id: "tm3", name: "Kavita Rao",    email: "kavita@vividview.com", avatar_initials: "KR", role: "rep",        performance_score: 63, territories: ["Delhi NCR"],                calls_made: 72,  emails_sent: 130, meetings_booked: 9,  deals_closed: 3,  revenue_generated: 2_10_000, rank: 8, targets: [mkTarget("t8a","revenue","Revenue",4_00_000,2_10_000,"m8","individual"),mkTarget("t8b","calls","Calls",90,72,"m8","individual"),mkTarget("t8c","closures","Closures",5,3,"m8","individual")] },
  { id: "m9", team_id: "tm3", name: "Sam Tiwari",    email: "sam@vividview.com",    avatar_initials: "ST", role: "rep",        performance_score: 78, territories: ["Gurugram"],                 calls_made: 104, emails_sent: 198, meetings_booked: 17, deals_closed: 7,  revenue_generated: 4_80_000, rank: 5, targets: [mkTarget("t9a","revenue","Revenue",7_00_000,4_80_000,"m9","individual"),mkTarget("t9b","calls","Calls",120,104,"m9","individual"),mkTarget("t9c","closures","Closures",9,7,"m9","individual")] },
];

export const MOCK_TEAMS: Team[] = [
  {
    id: "tm1", name: "Alpha Squad", manager_name: "Alex Kumar", manager_id: "m1",
    color: "bg-purple-500", territory: "South India",
    members: MOCK_MEMBERS.filter(m => m.team_id === "tm1"),
    targets: [
      mkTarget("tt1","revenue","Team Revenue",25_00_000,19_70_000,"tm1","team"),
      mkTarget("tt2","calls","Team Calls",400,368,"tm1","team"),
      mkTarget("tt3","closures","Team Closures",33,27,"tm1","team"),
    ],
  },
  {
    id: "tm2", name: "Beta Force",  manager_name: "Meera Joshi", manager_id: "m4",
    color: "bg-blue-500", territory: "West India",
    members: MOCK_MEMBERS.filter(m => m.team_id === "tm2"),
    targets: [
      mkTarget("tt4","revenue","Team Revenue",20_00_000,14_30_000,"tm2","team"),
      mkTarget("tt5","calls","Team Calls",350,300,"tm2","team"),
      mkTarget("tt6","closures","Team Closures",25,20,"tm2","team"),
    ],
  },
  {
    id: "tm3", name: "Gamma Unit",  manager_name: "Arjun Sharma", manager_id: "m7",
    color: "bg-emerald-500", territory: "North India",
    members: MOCK_MEMBERS.filter(m => m.team_id === "tm3"),
    targets: [
      mkTarget("tt7","revenue","Team Revenue",19_00_000,12_70_000,"tm3","team"),
      mkTarget("tt8","calls","Team Calls",340,294,"tm3","team"),
      mkTarget("tt9","closures","Team Closures",24,18,"tm3","team"),
    ],
  },
];

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await new Promise((r) => setTimeout(r, 300));
      setTeams(MOCK_TEAMS);
      setLoading(false);
    };
    load();
  }, []);

  const updateTarget = useCallback((teamId: string, targetId: string, updates: Partial<Target>) => {
    setTeams((p) => p.map((t) =>
      t.id === teamId
        ? { ...t, targets: t.targets.map((tgt) => tgt.id === targetId ? { ...tgt, ...updates } : tgt) }
        : t
    ));
  }, []);

  const updateMemberTarget = useCallback((memberId: string, targetId: string, updates: Partial<Target>) => {
    setTeams((p) => p.map((t) => ({
      ...t,
      members: t.members.map((m) =>
        m.id === memberId
          ? { ...m, targets: m.targets.map((tgt) => tgt.id === targetId ? { ...tgt, ...updates } : tgt) }
          : m
      ),
    })));
  }, []);

  const allMembers = teams.flatMap((t) => t.members);

  return { teams, loading, allMembers, updateTarget, updateMemberTarget };
}

export { MOCK_MEMBERS };
