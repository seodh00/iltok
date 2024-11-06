import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import style from '@/styles/JobDetail.module.css';
import { parseISO, format, subHours } from 'date-fns';
import { useLanguage } from '@/hooks/useLanguage';

interface JobDetailType {
  id: number;
  updated_time: string;
  title: string;
  contents: string;
  uploader: {
    company_name: string;
    name: string;
    number: string;
  };
}

interface JobDetailProps {
  jobDetail: JobDetailType;
}

const JobDetail: React.FC<JobDetailProps> = ({ jobDetail }) => {
  const router = useRouter();
  const { currentLanguage, changeLanguage } = useLanguage();
  const [translatedTitle, setTranslatedTitle] = useState(jobDetail.title);
  const [translatedContents, setTranslatedContents] = useState(jobDetail.contents);
  const [isTranslating, setIsTranslating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isFloating, setIsFloating] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsFloating(window.innerHeight < document.body.scrollHeight);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleListClick = () => {
    router.push('/board');
  };

  const handleCopyPhoneNumber = (number: string) => {
    navigator.clipboard.writeText(number)
      .then(() => {
        alert('전화번호가 복사되었습니다!');
      })
      .catch(err => console.error('Failed to copy: ', err));
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd HH:mm');
  };

  const formatPhoneNumber = (number: string) => {
    if (number.length === 12 && number.startsWith('82')) {
      const formattedNumber = `0${number.slice(2)}`;
      return `${formattedNumber.slice(0, 3)}-${formattedNumber.slice(3, 7)}-${formattedNumber.slice(7)}`;
    }
    return number;
  };

  const handleApplyButtonClick = (number: string) => {
    const message = `114114KR에서 ${jobDetail.title} 보고 연락드립니다`;
    const url = `sms:${number}?body=${encodeURIComponent(message)}`;
    window.open(url);
  };

  // 번역 함수 수정
  const translate = async (text: string, targetLang: string) => {
    if (targetLang === 'ko') return text;
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      );
      const data = await response.json();
      
      // 번역된 문장들을 공백 없이 합치기
      return data[0]
        .map((item: any[]) => item[0])
        .filter(Boolean)
        .join('');
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  // 언어 변경 핸들러 수정
  const handleLanguageChange = (lang: string) => {
    if (lang === currentLanguage || isTranslating) return;
    changeLanguage(lang);  // useLanguage의 changeLanguage 사용
  };

  // 언어 변경 시 번역 실행
  useEffect(() => {
    const translateContent = async () => {
      if (currentLanguage === 'ko' || isTranslating) {
        setTranslatedTitle(jobDetail.title);
        setTranslatedContents(jobDetail.contents);
        return;
      }

      setIsTranslating(true);
      try {
        // 제목 번역
        const newTitle = await translate(jobDetail.title, currentLanguage);
        
        // 내용 번역 - 전체 내용을 한 번에 번역
        const newContents = await translate(jobDetail.contents, currentLanguage);
        
        setTranslatedTitle(newTitle);
        setTranslatedContents(newContents);
      } catch (error) {
        console.error('Translation error:', error);
        // 에러 발생 시 원본 텍스트 유지
        setTranslatedTitle(jobDetail.title);
        setTranslatedContents(jobDetail.contents);
      } finally {
        setIsTranslating(false);
      }
      
    };

    translateContent();
  }, [currentLanguage, jobDetail]);

  return (
    <div className={style.layout}>

      {copySuccess && <div className={style.copyAlert}>전화번호가 복사되었습니다!</div>}
      
      <div className={style.articleTitle}>
        <h1>{translatedTitle}</h1>
      </div>
      <ul className={style.articleMeta}>
        <li>등록일: {formatDate(jobDetail.updated_time)}</li>
        <li>글번호: {jobDetail.id}</li>
      </ul>
      <ul className={`${style.articleMeta} ${style.bold}`}>
        <li>업체명: {jobDetail.uploader.company_name || "정보없음"}</li>
        <li>대표자명: {jobDetail.uploader.name || "정보없음"}</li>
      </ul>
      <div className={style.articleDetail}>
      <div className={style.languageSelector}>
        <button 
          className={currentLanguage === 'ko' ? style.activeLanguage : ''} 
          onClick={() => changeLanguage('ko')}
        >
          한국어
        </button>
        <button 
          className={currentLanguage === 'en' ? style.activeLanguage : ''} 
          onClick={() => changeLanguage('en')}
        >
          English
        </button>
        <button 
          className={currentLanguage === 'zh' ? style.activeLanguage : ''} 
          onClick={() => changeLanguage('zh')}
        >
          中文
        </button>
        <button 
          className={currentLanguage === 'ja' ? style.activeLanguage : ''} 
          onClick={() => changeLanguage('ja')}
        >
          日本語
          </button>
        </div>
        <div className={style.content}>
          {jobDetail.id === 6599 ? ( 
            <img 
              src="/landing_ad.png" 
              alt="Landing Ad" 
              style={{ maxWidth: '980px', width: '100%', height: 'auto' }}
            /> 
          ) : ( 
            <>
              {translatedContents.split('\n').map((line: string, index: number) => (
                <React.Fragment key={index}>
                  {line}
                  <br />
                
                </React.Fragment>
              ))}
            </>
          )} 
        </div>
        {jobDetail.uploader.number && (
          <li>
            <span 
              onClick={() => handleCopyPhoneNumber(formatPhoneNumber(jobDetail.uploader.number))} 
            >
              전화번호: <span style={{ cursor: 'pointer', color: '#ff3900', textDecoration: 'underline' }}
              >{formatPhoneNumber(jobDetail.uploader.number)}</span>
            </span>
            <button 
              className={style.applyButton} 
              onClick={() => handleApplyButtonClick(formatPhoneNumber(jobDetail.uploader.number))}
            >
              문자 지원하기
            </button>
          </li>
        )}
        <li>*114114KR 통해서 연락한다고 말씀해주세요.</li>
      </div>
      <div className={style.articleFoot}>
        <div className={style.txt}>
          ※ 위 내용에 대한 오류와 사용자가 이를 신뢰하여 취한 조치에 대해 114114KR은 책임을 지지 않습니다.
        </div>
        <div className={style.txt}>
          ※ 114114KR 통해서 연락한다고 말씀해주세요.
        </div>
        <ul className={style.acts}>
          <li><a href="#" onClick={handleListClick}>목록</a></li>
        </ul>
      </div>
    </div>
  );
};

export default JobDetail;
