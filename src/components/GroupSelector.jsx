import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function GroupSelector({ onGroupSelect }) {
  const [buildings, setBuildings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(false);

  // Загружаем корпуса при монтировании
  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name');

      if (error) throw error;
      setBuildings(data || []);
    } catch (error) {
      console.error('Ошибка загрузки корпусов:', error);
    }
  };

  // Загружаем курсы при выборе корпуса
  useEffect(() => {
    if (selectedBuilding) {
      loadCourses(selectedBuilding);
    } else {
      setCourses([]);
      setSelectedCourse('');
    }
  }, [selectedBuilding]);

  const loadCourses = async (buildingId) => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('building_id', buildingId)
        .order('course_number');

      if (error) throw error;
      setCourses(data || []);
      setSelectedCourse('');
      setGroups([]);
      setSelectedGroup('');
    } catch (error) {
      console.error('Ошибка загрузки курсов:', error);
    }
  };

  // Загружаем группы при выборе курса
  useEffect(() => {
    if (selectedCourse) {
      loadGroups(selectedCourse);
    } else {
      setGroups([]);
      setSelectedGroup('');
    }
  }, [selectedCourse]);

  const loadGroups = async (courseId) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('student_groups')
        .select('*')
        .eq('course_id', courseId)
        .order('group_number');

      if (error) throw error;
      setGroups(data || []);
      setSelectedGroup('');
    } catch (error) {
      console.error('Ошибка загрузки групп:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обработчик выбора группы
  const handleGroupSelect = (groupId) => {
    setSelectedGroup(groupId);
    onGroupSelect(groupId);
  };

  return (
    <div className="space-y-4">
      {/* Выбор корпуса */}
      <div>
        <label className="block text-sm font-medium mb-2">Корпус</label>
        <select
          value={selectedBuilding}
          onChange={(e) => setSelectedBuilding(e.target.value)}
          className="w-full p-3 border rounded-lg bg-white"
        >
          <option value="">Выберите корпус</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
      </div>

      {/* Выбор курса */}
      <div>
        <label className="block text-sm font-medium mb-2">Курс</label>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          disabled={!selectedBuilding}
          className="w-full p-3 border rounded-lg bg-white disabled:bg-gray-100"
        >
          <option value="">Выберите курс</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              Курс {course.course_number}
            </option>
          ))}
        </select>
      </div>

      {/* Выбор группы */}
      <div>
        <label className="block text-sm font-medium mb-2">Группа</label>
        <select
          value={selectedGroup}
          onChange={(e) => handleGroupSelect(e.target.value)}
          disabled={!selectedCourse || loading}
          className="w-full p-3 border rounded-lg bg-white disabled:bg-gray-100"
        >
          <option value="">Выберите группу</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              Группа {group.group_number}
            </option>
          ))}
        </select>
        {loading && <div className="text-sm text-gray-500 mt-1">Загрузка групп...</div>}
      </div>

      {/* Отладочная информация */}
      <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
        <div>Выбрано: Корпус={selectedBuilding}, Курс={selectedCourse}, Группа={selectedGroup}</div>
        <div>Доступно: Корпусов={buildings.length}, Курсов={courses.length}, Групп={groups.length}</div>
      </div>
    </div>
  );
}