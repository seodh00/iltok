import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import style from '@/styles/WriteComponent.module.css';
import { createClient } from '@supabase/supabase-js';
import Modal from '@/components/Modal';
import { addHours, format, subHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Link from 'next/link';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface JobForm {
  id?: number;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  contents: string;
  board_type: string; // Add this line
}

const WritePage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query; // URL에서 id 파라미터 가져오기
  const [formData, setFormData] = useState<JobForm>({
    title: '',
    '1depth_region': '',
    '2depth_region': '',
    '1depth_category': '',
    '2depth_category': '',
    contents: '',
    board_type: '0' // Add this line with default value '0' for 구인정보
  });
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (id && currentUserId) {
      setIsEditing(true);
      console.log('Editing mode activated. ID:', id);
      fetchJobData(Number(id));
    }
  }, [id, currentUserId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    } else {
      // 로그인되지 않은 경우 처리
      setErrorMessage('로그인이 필요합니다.');
      setIsModalOpen(true);
      router.push('/login'); // 또는 적절한 로그인 페이지로 리다이렉트
    }
  };

  const fetchJobData = async (jobId: number) => {
    try {
      console.log('Fetching job data for ID:', jobId);
      const { data, error } = await supabase
        .from('jd')
        .select('*, uploader_id')
        .eq('id', jobId)
        .single();

      if (error) throw error;

      if (data) {
        console.log('Fetched data:', data);
        console.log('Current user ID:', currentUserId);

        if (data.uploader_id === null) {
          setErrorMessage('이 게시글의 작성자 정보가 없습니다. 관리자에게 문의해주세요.');
          setIsModalOpen(true);
          router.push('/board');
          return;
        }
        
        if (data.uploader_id !== currentUserId) {
          setErrorMessage('자신이 작성한 글만 수정할 수 있습니다.');
          setIsModalOpen(true);
          router.push('/board');
          return;
        }
        setFormData(data);
        console.log('Form data set:', data);
      }
    } catch (error) {
      console.error('Error fetching job data:', error);
      setErrorMessage('데이터를 불러오는 중 오류가 발생했습니다.');
      setIsModalOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // 필수 필드 검증
    if (!formData.board_type || !formData.title || !formData.contents) {
      setErrorMessage('모든 필드를 채워주세요.');
      setIsModalOpen(true);
      return;
    }

    if (formData.board_type === '0' || formData.board_type === '1') {
      if (!formData['1depth_region'] || !formData['2depth_region'] || 
          !formData['1depth_category']) {
        setErrorMessage('모든 필드를 채워주세요.');
        setIsModalOpen(true);
        return;
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('로그인이 필요합니다.');
        setIsModalOpen(true);
        return;
      }

      console.log('Submitting form. Is editing:', isEditing);
      console.log('Current form data:', formData);

      if (isEditing) {
        console.log('Updating existing data for ID:', id);
        console.log('Form data before update:', formData);

        // 현재 KST 시간 계산
        const now = new Date();
        const koreaTime = addHours(now, 9);
  

        // 기존 데이터 업데이트
        const { data: updatedData, error: updateError, count } = await supabase
          .from('jd')
          .update({
            title: formData.title,
            '1depth_region': formData['1depth_region'],
            '2depth_region': formData['2depth_region'],
            '1depth_category': formData['1depth_category'],
            '2depth_category': formData['2depth_category'],
            contents: formData.contents,
            updated_time: koreaTime // 현재 KST 시간 추가
          })
          .eq('id', id)
          .select();

        if (updateError) {
          console.error('Update error:', updateError);
          throw updateError;
        }

        console.log('Data updated successfully. Updated data:', updatedData);
        console.log('Number of rows affected:', count);

        if (!updatedData || updatedData.length === 0) {
          console.error('No data returned after update');
          setErrorMessage('데이터 업데이트 후 반환된 데이터가 없습니다.');
          setIsModalOpen(true);
          return;
        }

        // 업데이트된 데이터로 폼 상태 갱신
        setFormData(updatedData[0]);

        // 수정 후 users.is_upload를 true로 변경
        const { error: updateUserError } = await supabase
          .from('users')
          .update({ is_upload: true })
          .eq('id', user.id);

        if (updateUserError) throw updateUserError;

      } else {
        // 새 데이터 생성
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('is_upload')
          .eq('id', user.id)
          .single();

        if (userError) throw userError;

        if (userData.is_upload) {
          setErrorMessage('공고는 하루에 하나만 올릴 수 있습니다.');
          setIsModalOpen(true);
          return;
        }

        const { data, error } = await supabase
          .from('jd')
          .insert([{ ...formData, uploader_id: user.id, ad: false }]);

        if (error) throw error;

        const { error: updateError } = await supabase
          .from('users')
          .update({ is_upload: true })
          .eq('id', user.id);

        if (updateError) throw updateError;

        console.log('Data inserted successfully:', data);
      }

      // 성공 시 목록 페이지로 이동
      console.log('Redirecting to board page');
      router.push('/board');
    } catch (error) {
      console.error('Error processing data:', error);
      setErrorMessage('데이터 처리 중 오류가 발생했습니다.');
      setIsModalOpen(true);
    }
  };

  const locations: { [key: string]: string[] } = {
    서울: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구","강동구"],
    부산: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"],
    대구: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군"],
    인천: ["중구", "동구", "남구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"],
    광주: ["동구", "서구", "남구", "북구", "광산구"],
    대전: ["동구", "중구", "서구", "유성구", "대덕구"],
    울산: ["중구", "남구", "동구", "북구", "울주군"],
    세종: [""],
    경기: ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "광명시", "김포시", "군포시", "광주시", "이천시", "양주시", "오산시", "구리시", "안성시", "포천시", "의왕시", "하남시", "여주시", "여주군", "양평군", "동두천시", "과천시", "가평군", "연천군"],
    강원: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "제군", "고성군", "양양군"],
    충북: ["청주시", "충주시", "제천시", "청원군", "보은군", "옥천군", "영동군", "진천군", "괴산군", "음성군", "단양군", "증군"],
    충남: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "당진군", "금산군", "연기군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"],
    전북: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"],
    전남: ["목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"],
    경북: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "군위군", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"],
    경남: ["창원시", "마산시", "진주시", "진해시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"],
    제주: ["제주시", "서귀포시", "북제주군", "남제주군"]
  };

  const categories: { [key: string]: string[] } = {
    "교육·강사": ["학습지교사", "학원강사", "방과후교사", "전문강사"],
    "사무직": ["일반사무", "경리", "회계", "인사"],
    "판매·영업": ["매장관리", "판매", "영업", "텔레마케터"],
    "생산·건설": ["생산직", "건설", "기술직", "노무직"],
    "서비스직·음식": ["서빙", "요리", "미용", "숙박"],
    "IT·디자인": ["웹개발", "앱개발", "그래픽디자인", "UI/UX"],
    "운전": ["택시", "버스", "화물", "배달"]
  };

  const showLocationAndCategory = formData.board_type === '0' || formData.board_type === '1';

  return (
    <div className={style.layout}>
      <form onSubmit={handleSubmit}>
        {errorMessage && <p className={style.errorMessage}>{errorMessage}</p>}
        <dl className={`${style.formGroup} ${style.hd}`}>
          <dt>게시판:</dt>
          <dd>
            <ul className={style.chooseType}>
              <li>
                <input
                  className={style.radio}
                  id="type_0"
                  name="board_type"
                  type="radio"
                  value="0"
                  checked={formData.board_type === '0'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_0">구인정보</label>
              </li>
              <li>
                <input
                  className={style.radio}
                  id="type_1"
                  name="board_type"
                  type="radio"
                  value="1"
                  checked={formData.board_type === '1'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_1">구직정보</label>
              </li>
              <li>
                <input
                  className={style.radio}
                  id="type_2"
                  name="board_type"
                  type="radio"
                  value="2"
                  checked={formData.board_type === '2'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_2">중고시장</label>
              </li>
              <li>
                <input
                  className={style.radio}
                  id="type_3"
                  name="board_type"
                  type="radio"
                  value="3"
                  checked={formData.board_type === '3'}
                  onChange={handleInputChange}
                />
                <label htmlFor="type_3">부동산정보</label>
              </li>
            </ul>
          </dd>
        </dl>
        
        {showLocationAndCategory && (
          <>
            <dl className={style.formGroup}>
              <dt>지역:</dt>
              <dd>
                <div className={style.selectBox}>
                  <select
                    name="1depth_region"
                    value={formData['1depth_region']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">시/도</option>
                    {Object.keys(locations).map((city, index) => (
                      <option key={index} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div className={style.selectBox}>
                  <select
                    name="2depth_region"
                    value={formData['2depth_region']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">시/구/군</option>
                    {formData['1depth_region'] && locations[formData['1depth_region']].map((district, index) => (
                      <option key={index} value={district}>{district}</option>
                    ))}
                  </select>
                </div>
              </dd>
            </dl>

            <dl className={style.formGroup}>
              <dt>분류:</dt>
              <dd>
                <div className={style.selectBox}>
                  <select
                    name="1depth_category"
                    value={formData['1depth_category']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">대분류</option>
                    {Object.keys(categories).map((category, index) => (
                      <option key={index} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                <div className={style.selectBox}>
                  <select
                    name="2depth_category"
                    value={formData['2depth_category']}
                    onChange={handleInputChange}
                    className={style.select}
                  >
                    <option value="">소분류</option>
                    {formData['1depth_category'] && categories[formData['1depth_category']].map((subCategory, index) => (
                      <option key={index} value={subCategory}>{subCategory}</option>
                    ))}
                  </select>
                </div>
              </dd>
            </dl>
          </>
        )}

        <dl className={style.formGroup}>
          <dt>제목:</dt>
          <dd>
            <input
              name="title"
              type="text"
              className={`${style.input} ${style.title}`}
              placeholder="제목을 입력해주세요.(한자 및 특수문 사용금지)"
              value={formData.title}
              onChange={handleInputChange}
              maxLength={50}
            />
          </dd>
        </dl>

        <dl className={style.formGroup}>
          <dt>상세 내용:</dt>
          <dd>
            <textarea
              name="contents"
              className={style.textarea}
              placeholder="내용을 입력해주세요."
              value={formData.contents}
              onChange={handleInputChange}
            ></textarea>
          </dd>
        </dl>

        <dl className={`${style.formGroup} ${style.ft}`}>
          <dd>
            <button type="submit" className={style.submitButton}>
              {isEditing ? '수정하기' : '등록하기'}
            </button>
          </dd>
        </dl>
      </form>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <p>{errorMessage}</p>
      </Modal>
    </div>
  );
};

export default WritePage;
