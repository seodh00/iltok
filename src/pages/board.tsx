import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import MainMenu from '@/components/MainMenu';
import JobFilter from '@/components/JobFilter';
import JobList from '@/components/JobList';
import Pagination from '@/components/Pagination';
import Footer from '@/components/Footer';
import styles from '@/styles/Board.module.css';
import { createClient } from '@supabase/supabase-js'
import Head from 'next/head'// 사용자에게 알림을 표시하기 위해 추가

// Supabase 클라이언트 생성
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FilterOptions {
  city1: string;
  city2: string;
  cate1: string;
  cate2: string;
  keyword: string;
}

interface Job {
  id: number;
  updated_time: string;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  ad: boolean;
}

interface AdJob extends Job {
  ad: true;
}

const BoardPage: React.FC = () => {

  const router = useRouter();
  const [regularJobs, setRegularJobs] = useState<Job[]>([]);
  const [adJobs, setAdJobs] = useState<AdJob[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filters, setFilters] = useState<FilterOptions>({
    city1: '',
    city2: '',
    cate1: '',
    cate2: '',
    keyword: ''
  });
  const [city2Options, setCity2Options] = useState<string[]>([]);
  const [cate2Options, setCate2Options] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [boardType, setBoardType] = useState<string>('0'); // 기본값을 '0'으로 설정

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    // city1이 변경되었는지 확인
    if (newFilters.city1 !== filters.city1) {
      // city1이 변경되었다면 city2를 초기화
      newFilters.city2 = '';
    }

    setFilters(newFilters);
    setCurrentPage(1);  // 필터가 변경되면 첫 페이지로 돌아갑니다
    
    const query = {
      ...newFilters,
      page: '1'  // 페이지를 1로 설정
    };
    router.push({
      pathname: router.pathname,
      query: query
    }, undefined, { shallow: true });
  }, [filters, router]);

  const fetchJobs = useCallback(async (currentFilters: FilterOptions, page: number, currentBoardType: string) => {
    setIsLoading(true);
    try {
      const { city1, city2, cate1, cate2, keyword } = currentFilters;
      const pageSize = 50; // 페이지당 항목 수

      // Fetch regular jobs
      let regularQuery = supabase
        .from('jd')
        .select('*', { count: 'exact' })
        .eq('ad', false)
        .eq('board_type', currentBoardType) // board_type으로 필터링
        .order('updated_time', { ascending: false });

      if (city1) regularQuery = regularQuery.eq('1depth_region', city1);
      if (city2) regularQuery = regularQuery.eq('2depth_region', city2);
      if (cate1) regularQuery = regularQuery.eq('1depth_category', cate1);
      if (cate2) regularQuery = regularQuery.eq('2depth_category', cate2);
      if (keyword) regularQuery = regularQuery.ilike('title', `%${keyword}%`);

      const offset = (page - 1) * pageSize;
      regularQuery = regularQuery.range(offset, offset + pageSize - 1);

      const { data: regularData, error: regularError, count } = await regularQuery;

      if (regularError) {
        throw new Error(`Error fetching regular jobs: ${regularError.message}`);
      }

      setRegularJobs(regularData || []);
      setTotalPages(Math.ceil((count || 0) / pageSize));

      // Fetch ad jobs (only for the first page)
      if (page === 1) {
        let adQuery = supabase
          .from('jd')
          .select('*')
          .eq('ad', true)
          .eq('board_type', currentBoardType) // board_type으로 필터링
          .order('updated_time', { ascending: false });

        if (city1) adQuery = adQuery.eq('1depth_region', city1);
        if (city2) adQuery = adQuery.eq('2depth_region', city2);
        if (cate1) adQuery = adQuery.eq('1depth_category', cate1);
        if (cate2) adQuery = adQuery.eq('2depth_category', cate2);
        if (keyword) adQuery = adQuery.ilike('title', `%${keyword}%`);

        const { data: adData, error: adError } = await adQuery;

        if (adError) {
          throw new Error(`Error fetching ad jobs: ${adError.message}`);
        }

        setAdJobs(adData as AdJob[] || []);
      } else {
        setAdJobs([]);
      }

      setError(null);
    } catch (err) {
      console.error('Error in fetchJobs:', err);
      setError('데이터를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    const { city1, city2, cate1, cate2, keyword, page, board_type } = router.query;
    let newFilters = {
      city1: city1 as string || '',
      city2: city2 as string || '',
      cate1: cate1 as string || '',
      cate2: cate2 as string || '',
      keyword: keyword as string || ''
    };

    const newBoardType = board_type as string || '0'; // 기본값을 '0'으로 설정
    const newPage = page ? parseInt(page as string) : 1;
    
    setFilters(newFilters);
    setBoardType(newBoardType);
    setCurrentPage(newPage);
    fetchJobs(newFilters, newPage, newBoardType);
  }, [router.isReady, router.query, fetchJobs]);

  const handlePageChange = (newPage: number) => {
    const query = {
      ...filters,
      page: newPage.toString(),
      board_type: boardType
    };
    router.push({
      pathname: router.pathname,
      query: query
    }, undefined, { shallow: true });
  };

  const updateURL = (newFilters: FilterOptions, newPage: number) => {
    const query = {
      ...newFilters,
      page: newPage.toString(),
      board_type: boardType
    };
    router.push({
      pathname: router.pathname,
      query: query
    }, undefined, { shallow: true });
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>구인구직 게시판 | 114114KR</title>
        <meta name="description" content="다양한 직종의 구인구직 정보를 찾아보세요. 지역별, 카테고리별로 필터링하여 원하는 일자��를 쉽게 찾을 수 있습니다." />
        <meta name="keywords" content="구인구직, 채용정보, 일자리, 취업" />
        <meta property="og:title" content="구인구직 게시판 | 당신의 회사 이름" />
        <meta property="og:description" content="다양한 직종의 구구직 정보를 찾아세요. 지역별, 카테고리별로 필터링하여 원하는 일자리를 쉽게 찾을 수 있습니다." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://114114KR.com/board" />
        <meta property="og:image" content="https://114114KR.com/og-image.jpg" />
      </Head>

      <Header/>
      <div className={styles.layout}>
        <MainMenu currentBoardType={boardType} />
        <JobFilter
          filters={filters}
          onFilterChange={handleFilterChange}
          city2Options={city2Options}
          cate2Options={cate2Options}
        />
        <JobList 
          jobs={regularJobs}
          adJobs={adJobs}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </div>
      <Footer />
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default BoardPage;
