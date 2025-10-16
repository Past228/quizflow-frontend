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
  const [debug, setDebug] = useState('');

  // Загружаем корпуса при монтировании
  useEffect(() => {
    loadBuildings();
  }, []);

  const loadBuildings = async () => {
    setLoading(prev => ({ ...prev, buildings: true }));
    setDebug('Загрузка корпусов...');
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select('*')
        .order('name');

      if (error) {
        console.error('❌ Ошибка загрузки корпусов:', error);
        setDebug(`Ошибка: ${error.message}`);
        return;
      }

      setBuildings(data || []);
      setDebug(`✅ Загружено корпусов: ${data?.length || 0}`);
    } catch (error) {
      console.error('💥 Ошибка:', error);
      setDebug(`💥 ${error.message}`);
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
    setDebug(`Загрузка курсов для корпуса ${buildingId}...`);
    try {
      // Сначала получаем название выбранного корпуса
      const selectedBuildingObj = buildings.find(b => b.id == buildingId);
      const buildingName = selectedBuildingObj?.name;
      
      console.log('🏢 Выбран корпус:', buildingName);

      // Загружаем все курсы для этого корпуса
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('building_id', buildingId)
        .order('course_number');

      if (error) {
        console.error('❌ Ошибка загрузки курсов:', error);
        setDebug(`Ошибка курсов: ${error.message}`);
        return;
      }

      // ФИЛЬТРУЕМ КУРСЫ ПО ЛОГИКЕ:
      let filteredCourses = [];
      
      if (buildingName === 'СП-1') {
        // Для СП-1 показываем только 1 курс
        filteredCourses = data.filter(course => course.course_number === 1);
        console.log('📚 Для СП-1 отображаем только 1 курс:', filteredCourses);
      } else {
        // Для остальных корпусов показываем 2, 3, 4 курсы
        filteredCourses = data.filter(course => [2, 3, 4].includes(course.course_number));
        console.log('📚 Для других корпусов отображаем курсы 2,3,4:', filteredCourses);
      }

      setCourses(filteredCourses);
      setSelectedCourse('');
      setGroups([]);
      setSelectedGroup('');
      onGroupSelect(null);
      
      setDebug(`✅ Курсов доступно: ${filteredCourses.length}`);
      
    } catch (error) {
      console.error('💥 Ошибка загрузки курсов:', error);
      setDebug(`💥 Ошибка: ${error.message}`);
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
    setDebug(`Загрузка групп для курса ${courseId}...`);
    try {
      const { data, error } = await supabase
        .from('student_groups')
        .select('*')
        .eq('course_id', courseId)
        .order('group_number');

      if (error) {
        console.error('❌ Ошибка загрузки групп:', error);
        setDebug(`Ошибка групп: ${error.message}`);
        return;
      }

      setGroups(data || []);
      setSelectedGroup('');
      onGroupSelect(null);
      setDebug(`✅ Групп доступно: ${data?.length || 0}`);
    } catch (error) {
      console.error('💥 Ошибка загрузки групп:', error);
      setDebug(`💥 Ошибка: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, groups: false }));
    }
  };

  const handleGroupSelect = (groupId) => {
    console.log('🎯 Выбрана группа:', groupId);
    setSelectedGroup(groupId);
    onGroupSelect(groupId);
    setDebug(`✅ Группа выбрана: ${groupId}`);
  };

  const handleReset = () => {
    setSelectedBuilding('');
    setSelectedCourse('');
    setSelectedGroup('');
    setCourses([]);
    setGroups([]);
    setDebug('');
    onGroupSelect(null);
  };

  // Получаем название выбранного корпуса для отображения
  const selectedBuildingName = buildings.find(b => b.id == selectedBuilding)?.name || '';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Выбор группы</h3>
        <button
          onClick={handleReset}
          className="text-sm text-blue-600 underline hover:text-blue-800"
        >
          Сбросить
        </button>
      </div>

      {/* Отладочная информация */}
      {debug && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-800">
            <div className="font-medium">Статус: {debug}</div>
            {selectedBuildingName && (
              <div>Выбран корпус: {selectedBuildingName}</div>
            )}
          </div>
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
          <div className="text-sm text-blue-500 mt-1 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            Загрузка корпусов...
          </div>
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
          <option value="">
            {!selectedBuilding ? 'Сначала выберите корпус' : 
             loading.courses ? 'Загрузка курсов...' : 
             courses.length === 0 ? 'Нет доступных курсов' : 'Выберите курс'}
          </option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              Курс {course.course_number}
            </option>
          ))}
        </select>
        {loading.courses && (
          <div className="text-sm text-blue-500 mt-1 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            Загрузка курсов...
          </div>
        )}
        
        {/* Подсказка о доступных курсах */}
        {selectedBuilding && courses.length > 0 && (
          <div className="text-sm text-gray-600 mt-1">
            {selectedBuildingName === 'СП-1' 
              ? 'Доступен только 1 курс' 
              : 'Доступны курсы: 2, 3, 4'}
          </div>
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
          <option value="">
            {!selectedCourse ? 'Сначала выберите курс' : 
             loading.groups ? 'Загрузка групп...' : 
             groups.length === 0 ? 'Нет доступных групп' : 'Выберите группу'}
          </option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              Группа {group.group_number}
            </option>
          ))}
        </select>
        {loading.groups && (
          <div className="text-sm text-blue-500 mt-1 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            Загрузка групп...
          </div>
        )}
      </div>

      {/* Информация о выборе */}
      {selectedGroup && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-700 flex items-center">
            <span className="mr-2">✅</span>
            Группа выбрана успешно! (ID: {selectedGroup})
          </div>
        </div>
      )}
    </div>
  );
}