import { useState, useEffect } from 'react';

export default function GroupSelector({ onGroupSelect }) {
  const [buildings, setBuildings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState({
    buildings: false,
    courses: false,
    groups: false
  });
  const [error, setError] = useState('');

  const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchBuildings();
  }, [API_BASE]);

  const fetchBuildings = async () => {
    try {
      setLoading(prev => ({ ...prev, buildings: true }));
      setError('');
      
      const response = await fetch(`${API_BASE}/api/buildings`);
      if (!response.ok) throw new Error('Ошибка загрузки корпусов');
      
      const data = await response.json();
      setBuildings(data);
    } catch (error) {
      console.error('Error fetching buildings:', error);
      setError('Не удалось загрузить список корпусов');
    } finally {
      setLoading(prev => ({ ...prev, buildings: false }));
    }
  };

  useEffect(() => {
    if (!selectedBuilding) {
      setCourses([]);
      return;
    }
    
    fetchCourses(selectedBuilding);
    
    setSelectedCourse('');
    setSelectedGroup('');
    setGroups([]);
  }, [selectedBuilding, API_BASE]);

  const fetchCourses = async (buildingId) => {
    try {
      setLoading(prev => ({ ...prev, courses: true }));
      setError('');
      
      const response = await fetch(`${API_BASE}/api/buildings/${buildingId}/courses`);
      if (!response.ok) throw new Error('Ошибка загрузки курсов');
      
      const data = await response.json();
      setCourses(data);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError('Не удалось загрузить список курсов');
    } finally {
      setLoading(prev => ({ ...prev, courses: false }));
    }
  };

  useEffect(() => {
    if (!selectedCourse) {
      setGroups([]);
      return;
    }
    
    fetchGroups(selectedCourse);
    
    setSelectedGroup('');
  }, [selectedCourse, API_BASE]);

  const fetchGroups = async (courseId) => {
    try {
      setLoading(prev => ({ ...prev, groups: true }));
      setError('');
      
      const response = await fetch(`${API_BASE}/api/courses/${courseId}/groups`);
      if (!response.ok) throw new Error('Ошибка загрузки групп');
      
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
      setError('Не удалось загрузить список групп');
    } finally {
      setLoading(prev => ({ ...prev, groups: false }));
    }
  };

  useEffect(() => {
    if (selectedGroup && onGroupSelect) {
      onGroupSelect(selectedGroup);
    } else if (!selectedGroup && onGroupSelect) {
      onGroupSelect(null);
    }
  }, [selectedGroup, onGroupSelect]);

  const handleBuildingChange = (e) => {
    setSelectedBuilding(e.target.value);
    setSelectedCourse('');
    setSelectedGroup('');
    setCourses([]);
    setGroups([]);
  };

  const handleCourseChange = (e) => {
    setSelectedCourse(e.target.value);
    setSelectedGroup('');
    setGroups([]);
  };

  const handleGroupChange = (e) => {
    setSelectedGroup(e.target.value);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
          <button 
            onClick={fetchBuildings}
            className="ml-2 underline hover:text-red-800"
          >
            Обновить
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Корпус {loading.buildings && '⏳'}
        </label>
        <select 
          value={selectedBuilding} 
          onChange={handleBuildingChange}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
          disabled={loading.buildings}
        >
          <option value="">Выберите корпус</option>
          {buildings.map(building => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
        {!selectedBuilding && buildings.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">Выберите учебный корпус</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Курс {loading.courses && '⏳'}
        </label>
        <select 
          value={selectedCourse} 
          onChange={handleCourseChange}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!selectedBuilding || loading.courses}
        >
          <option value="">Выберите курс</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.course_number} курс
            </option>
          ))}
        </select>
        {selectedBuilding && !selectedCourse && (
          <p className="text-xs text-gray-500 mt-1">
            {courses.length === 0 ? 'Загрузка курсов...' : 'Выберите номер курса'}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700">
          Группа {loading.groups && '⏳'}
        </label>
        <select 
          value={selectedGroup} 
          onChange={handleGroupChange}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
          disabled={!selectedCourse || loading.groups}
        >
          <option value="">Выберите группу</option>
          {groups.map(group => (
            <option key={group.id} value={group.id}>
              Группа {group.group_number}
            </option>
          ))}
        </select>
        {selectedCourse && !selectedGroup && (
          <p className="text-xs text-gray-500 mt-1">
            {groups.length === 0 ? 'Загрузка групп...' : 'Выберите учебную группу'}
          </p>
        )}
      </div>

      {/* Информация о выборе */}
      {selectedGroup && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center text-green-700">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Группа выбрана</span>
          </div>
        </div>
      )}

      {/* Отладочная информация (можно удалить в продакшене) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-2 bg-gray-100 rounded text-xs text-gray-600">
          <div><strong>Отладка:</strong></div>
          <div>Building: {selectedBuilding}</div>
          <div>Course: {selectedCourse}</div>
          <div>Group: {selectedGroup}</div>
          <div>Groups count: {groups.length}</div>
        </div>
      )}
    </div>
  );
}