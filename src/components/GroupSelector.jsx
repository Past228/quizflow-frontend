import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function GroupSelector({ onGroupSelect }) {
  const [buildings, setBuildings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState({ buildings: false, courses: false, groups: false });
  const [error, setError] = useState('');

  // Загружаем корпуса при монтировании
  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    setLoading(prev => ({ ...prev, buildings: true }));
    setError('');
    try {
      console.log('🔄 Загрузка корпусов...');
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name');

      if (error) {
        console.error('❌ Ошибка загрузки корпусов:', error);
        setError('Ошибка загрузки корпусов: ' + error.message);
        return;
      }

      console.log('✅ Корпуса загружены:', data);
      setBuildings(data || []);
    } catch (error) {
      console.error('💥 Ошибка при загрузке корпусов:', error);
      setError('Не удалось загрузить корпуса');
    } finally {
      setLoading(prev => ({ ...prev, buildings: false }));
    }
  };

  // Загружаем курсы при выборе корпуса
  useEffect(() => {
    if (selectedBuilding) {
      loadCourses(selectedBuilding);
    } else {
      setCourses([]);
      setSelectedCourse('');
      setGroups([]);
      setSelectedGroup('');
      onGroupSelect(null);
    }
  }, [selectedBuilding]);

  const loadCourses = async (buildingId) => {
    setLoading(prev => ({ ...prev, courses: true }));
    setError('');
    try {
      console.log('🔄 Загрузка курсов для корпуса:', buildingId);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('building_id', buildingId)
        .order('course_number');

      if (error) {
        console.error('❌ Ошибка загрузки курсов:', error);
        setError('Ошибка загрузки курсов: ' + error.message);
        return;
      }

      console.log('✅ Курсы загружены:', data);
      setCourses(data || []);
      setSelectedCourse('');
      setGroups([]);
      setSelectedGroup('');
      onGroupSelect(null);
    } catch (error) {
      console.error('💥 Ошибка при загрузке курсов:', error);
      setError('Не удалось загрузить курсы');
    } finally {
      setLoading(prev => ({ ...prev, courses: false }));
    }
  };

  // Загружаем группы при выборе курса
  useEffect(() => {
    if (selectedCourse) {
      loadGroups(selectedCourse);
    } else {
      setGroups([]);
      setSelectedGroup('');
      onGroupSelect(null);
    }
  }, [selectedCourse]);

  const loadGroups = async (courseId) => {
    setLoading(prev => ({ ...prev, groups: true }));
    setError('');
    try {
      console.log('🔄 Загрузка групп для курса:', courseId);
      const { data, error } = await supabase
        .from('student_groups')
        .select('*')
        .eq('course_id', courseId)
        .order('group_number');

      if (error) {
        console.error('❌ Ошибка загрузки групп:', error);
        setError('Ошибка загрузки групп: ' + error.message);
        return;
      }

      console.log('✅ Группы загружены:', data);
      setGroups(data || []);
      setSelectedGroup('');
      onGroupSelect(null);
    } catch (error) {
      console.error('💥 Ошибка при загрузке групп:', error);
      setError('Не удалось загрузить группы');
    } finally {
      setLoading(prev => ({ ...prev, groups: false }));
    }
  };

  // Обработчик выбора группы
  const handleGroupSelect = (groupId) => {
    console.log('🎯 Выбрана группа:', groupId);
    setSelectedGroup(groupId);
    onGroupSelect(groupId);
  };

  return (
    <div className="space-y-4">
      {/* Сообщения об ошибках */}
      {error && (
        <div className="p-3 bg-red-100 border border-red-300 rounded-lg">
          <div className="text-red-700 text-sm">{error}</div>
          <button 
            onClick={loadBuildings}
            className="mt-2 text-red-600 underline text-xs"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {/* Выбор корпуса */}
      <div>
        <label className="block text-sm font-medium mb-2">Корпус</label>
        <select
          value={selectedBuilding}
          onChange={(e) => setSelectedBuilding(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading.buildings}
        >
          <option value="">Выберите корпус</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
        {loading.buildings && (
          <div className="text-sm text-blue-500 mt-1">Загрузка корпусов...</div>
        )}
      </div>

      {/* Выбор курса */}
      <div>
        <label className="block text-sm font-medium mb-2">Курс</label>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          disabled={!selectedBuilding || loading.courses}
          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">{selectedBuilding ? 'Выберите курс' : 'Сначала выберите корпус'}</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              Курс {course.course_number}
            </option>
          ))}
        </select>
        {loading.courses && (
          <div className="text-sm text-blue-500 mt-1">Загрузка курсов...</div>
        )}
      </div>

      {/* Выбор группы */}
      <div>
        <label className="block text-sm font-medium mb-2">Группа</label>
        <select
          value={selectedGroup}
          onChange={(e) => handleGroupSelect(e.target.value)}
          disabled={!selectedCourse || loading.groups}
          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="">{selectedCourse ? 'Выберите группу' : 'Сначала выберите курс'}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              Группа {group.group_number}
            </option>
          ))}
        </select>
        {loading.groups && (
          <div className="text-sm text-blue-500 mt-1">Загрузка групп...</div>
        )}
      </div>

      {/* Отладочная информация */}
      <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded-lg border">
        <div className="font-medium mb-1">Отладочная информация:</div>
        <div>Выбрано: Корпус={selectedBuilding || 'нет'}, Курс={selectedCourse || 'нет'}, Группа={selectedGroup || 'нет'}</div>
        <div>Доступно: Корпусов={buildings.length}, Курсов={courses.length}, Групп={groups.length}</div>
        <div>Загрузка: {JSON.stringify(loading)}</div>
        {buildings.length === 0 && !loading.buildings && (
          <div className="text-red-500 mt-1">⚠️ Корпуса не загружены. Проверьте подключение к базе.</div>
        )}
      </div>
    </div>
  );
}