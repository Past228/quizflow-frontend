import { useState, useEffect } from 'react';

export default function GroupSelector({ onGroupSelect }) {
  const [buildings, setBuildings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');

  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  useEffect(() => {
    fetch(`${API_BASE}/api/buildings`)
      .then(res => res.json())
      .then(setBuildings);
  }, [API_BASE]);

  useEffect(() => {
    if (!selectedBuilding) {
      setCourses([]);
      return;
    }
    
    fetch(`${API_BASE}/api/buildings/${selectedBuilding}/courses`)
      .then(res => res.json())
      .then(setCourses);
    
    setSelectedCourse('');
    setSelectedGroup('');
    setGroups([]);
  }, [selectedBuilding, API_BASE]);

  useEffect(() => {
    if (!selectedCourse) {
      setGroups([]);
      return;
    }
    
    fetch(`${API_BASE}/api/courses/${selectedCourse}/groups`)
      .then(res => res.json())
      .then(setGroups);
    
    setSelectedGroup('');
  }, [selectedCourse, API_BASE]);

  useEffect(() => {
    if (selectedGroup && onGroupSelect) {
      onGroupSelect(selectedGroup);
    }
  }, [selectedGroup, onGroupSelect]);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Корпус</label>
        <select 
          value={selectedBuilding} 
          onChange={(e) => setSelectedBuilding(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Выберите корпус</option>
          {buildings.map(building => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Курс</label>
        <select 
          value={selectedCourse} 
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="w-full p-2 border rounded"
          disabled={!selectedBuilding}
        >
          <option value="">Выберите курс</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.course_number} курс
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Группа</label>
        <select 
          value={selectedGroup} 
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="w-full p-2 border rounded"
          disabled={!selectedCourse}
        >
          <option value="">Выберите группу</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              {group.group_number}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}