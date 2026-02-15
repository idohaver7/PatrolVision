// src/screens/ViolationsHistoryScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SkeletonCard from '../components/SkeletonCard';
import styles from './ViolationsHistoryScreen.styles';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { fetchViolations } from '../services/api';

const FILTER_TYPES = [
  { id: 'all', label: 'All' },
  { id: 'Red Light Violation', label: 'Red Light' },
  { id: 'Illegal Overtaking', label: 'Overtaking' },
  { id: 'Public Lane Violation', label: 'Public Lane' },
];

const getViolationStyle = (type) => {
  switch (type) {
    case 'Red Light Violation':
      return { icon: 'traffic', color: '#D93025', bg: '#FCE8E6' };
    case 'Illegal Overtaking':
      return { icon: 'compare-arrows', color: '#F9AB00', bg: '#FEF7E0' };
    case 'Public Lane Violation':
      return { icon: 'directions-bus', color: '#0F9D58', bg: '#E6F4EA' };  
    default:
      return { icon: 'error-outline', color: '#5F6368', bg: '#F1F3F4' };
  }
};

const getStatusTheme = (status) => {
  switch (status) {
    case 'Verified':
      return { bg: '#E6F4EA', text: '#1E8E3E', label: 'Verified' };
    case 'Rejected':
    case 'Closed':
      return { bg: '#FCE8E6', text: '#C5221F', label: 'Rejected' };
    case 'Pending Review':
    default:
      return { bg: '#FEF7E0', text: '#B06000', label: 'Pending' };
  }
};

const ViolationItem = ({ item, onPress }) => {
  const statusTheme = getStatusTheme(item.status);
  const violationStyle = getViolationStyle(item.violationType);
  
  const locationText = item.address || 
    (item.location ? `${item.location.coordinates[1].toFixed(4)}, ${item.location.coordinates[0].toFixed(4)}` : 'Unknown Location');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.itemContainer, pressed && styles.itemPressed]}
    >
      <View style={[styles.iconContainer, { backgroundColor: violationStyle.bg }]}>
        <Icon 
          name={violationStyle.icon} 
          size={24} 
          color={violationStyle.color} 
        />
      </View>
      
      <View style={styles.detailsContainer}>
        <Text style={styles.violationType} numberOfLines={1}>
          {item.violationType}
        </Text>

        <View style={styles.rowInfo}>
          <Text style={styles.licensePlate}>{item.licensePlate}</Text>
          <Text style={{ fontSize: 12, color: '#A0AEC0' }}>•</Text>
          <Text style={styles.dateText}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.rowInfo}>
          <Icon name="place" size={14} color="#718096" style={{ marginRight: 4 }} />
          <Text style={styles.locationText} numberOfLines={1}>
            {locationText}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusTheme.bg }]}>
          <Text style={[styles.statusText, { color: statusTheme.text }]}>
            {statusTheme.label}
          </Text>
        </View>
      </View>
      
      <Image source={{ uri: item.mediaUrl }} style={styles.thumbnail} resizeMode="cover" />
    </Pressable>
  );
};

const ViolationsHistoryScreen = ({ navigation }) => {
  const { token } = useAuth();

  const [violations, setViolations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [selectedType, setSelectedType] = useState('all');
  const [searchText, setSearchText] = useState('');       
  const [sortOrder, setSortOrder] = useState('newest');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadViolations = useCallback(async (pageNumber, shouldRefresh = false) => {
    if (!token) return;
    
    if (shouldRefresh && pageNumber === 1) setIsLoading(true);

    try {
      const params = { 
        page: pageNumber, 
        limit: 10, 
        sort: sortOrder,
      };

      if (selectedType !== 'all') params.type = selectedType;
      if (searchText.length > 0) params.licensePlate = searchText;

      const response = await fetchViolations(token, params);
      const serverResponse = response.data; 
      const newViolations = serverResponse.data || []; 

      if (!Array.isArray(newViolations)) {
        console.error("Data format error: Expected array, got", newViolations);
        return; 
      }

      if (shouldRefresh) {
        setViolations(newViolations);
      } else {
        setViolations(prev => [...prev, ...newViolations]);
      }

      setHasMore(!!serverResponse.pagination?.next);

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not load violations');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [token, selectedType, searchText, sortOrder]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      loadViolations(1, true);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [selectedType, searchText, sortOrder, loadViolations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadViolations(1, true);
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore || isLoading) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadViolations(nextPage, false);
  };

  const renderFooter = () => {
    if (!isLoadingMore) return <View style={{ height: 20 }} />;
    return <View style={{ paddingVertical: 20 }}><ActivityIndicator size="small" color={COLORS.primary} /></View>;
  };

  const renderFilters = () => (
    <View>
      <View style={styles.searchContainer}>
        <Icon name="search" size={24} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search License Plate..."
          value={searchText}
          onChangeText={setSearchText}
          autoCapitalize="characters"
        />
        {searchText.length > 0 && (
          <Pressable onPress={() => setSearchText('')}>
            <Icon name="close" size={20} color="#999" />
          </Pressable>
        )}
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filtersContainer}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {FILTER_TYPES.map((type) => (
          <Pressable
            key={type.id}
            style={[
              styles.chip,
              selectedType === type.id && styles.chipSelected
            ]}
            onPress={() => setSelectedType(type.id)}
          >
            <Text style={[
              styles.chipText,
              selectedType === type.id && styles.chipTextSelected
            ]}>
              {type.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  // --- Main Render Logic ---

  //  If Loading (Initial Load) -> Show Skeleton
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {renderFilters()} 
        <View style={styles.list}>
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <SkeletonCard key={key} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  // 2. Main List
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {renderFilters()}

      <FlatList
        data={violations}
        renderItem={({ item }) => (
          <ViolationItem 
            item={item} 
            onPress={() => navigation.navigate('ViolationDetail', { violation: item })} 
          />
        )}
        keyExtractor={item => item._id}
        style={styles.list}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.loaderContainer}>
            <Text style={styles.loadingText}>No violations found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default ViolationsHistoryScreen;