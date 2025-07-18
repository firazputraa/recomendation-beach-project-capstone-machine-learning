import React, { useState, useRef, useEffect } from 'react';
import hero from '../../assets/hero.png';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { MapPin, ChevronLeft, ChevronRight, ExternalLink, Info } from 'lucide-react';
import beachpng from "../../assets/beach.png";

const tagOptions = ['Tenang', 'Penuh', 'Bersih', 'Perahu Pisang', 'Berenang Selancar', 'Snorkeling'];

const Homepage = () => {
  const [inputValue, setInputValue] = useState('');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoadingRecommend, setIsLoadingRecommend] = useState(false);

  // New state for search mode
  const [searchMode, setSearchMode] = useState('search'); // 'search' or 'recommend'

  // State and Ref for carousel
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollContainerRef = useRef(null);

  const navigate = useNavigate();
  const inputRef = useRef();
  const dropdownRef = useRef();

  // Fungsi untuk mendapatkan token JWT dari localStorage
  const getAuthToken = () => {
    return localStorage.getItem('token'); // Sesuaikan dengan kunci penyimpanan token Anda
  };

  // Close dropdown if click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setDropdownVisible(false);
      }
    };
    if (dropdownVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownVisible]);

  // Initial fetch for recommendations (e.g., default recommendations)
  const fetchRecommendations = async (preference = "pantai yang indah, sepi, dan bersih") => {
    setIsLoadingRecommend(true);
    const token = getAuthToken(); // Ambil token

    if (!token) {
      // Jika tidak ada token, tampilkan pesan dan mungkin redirect ke halaman login
      setIsLoadingRecommend(false);
      setRecommendations([]); // Kosongkan rekomendasi jika tidak login
      // Opsional: navigate('/login');
      return;
    }

    try {
      const response = await axios.post('https://recommendation-beach-backend-production.up.railway.app/beach/recommend', {
        preference_text: preference,
        top_n: 8
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      // Asumsi response.data.recommendations adalah array of { placeId: '...', score: X }
      const recommendedPlaceIds = response.data.recommendations; 

      if (recommendedPlaceIds && recommendedPlaceIds.length > 0) {
        const detailedRecommendations = await Promise.all(
          recommendedPlaceIds.map(async (rec) => {
            try {
              const detailResponse = await axios.get(`https://recommendation-beach-backend-production.up.railway.app/beach/${rec.placeId}`, {
                headers: {
                  Authorization: `Bearer ${token}`
                }
              });
              // Menggabungkan data detail dari /beach/{placeId} dengan score dari rekomendasi
              // Kami tetap menyimpan score jika diperlukan di tempat lain, tapi tidak akan menampilkannya di UI untuk "cocok"
              return { ...detailResponse.data, score: rec.score }; 
            } catch (detailError) {
              console.error(`Error fetching detail for placeId ${rec.placeId}:`, detailError);
              return null;
            }
          })
        );
        setRecommendations(detailedRecommendations.filter(Boolean));
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
        alert('Sesi Anda telah habis atau Anda belum login. Silakan login kembali.');
      } else {
        alert('Gagal memuat rekomendasi pantai. Silakan coba lagi nanti.');
      }
      setRecommendations([]);
    } finally {
      setIsLoadingRecommend(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(); // Fetch default recommendations on component mount
  }, []);

  const itemsPerView = 4;
  const maxIndex = recommendations ? Math.max(0, recommendations.length - itemsPerView) : 0;

  const scrollToIndex = (index) => {
    if (scrollContainerRef.current) {
      const cardWidth = 256 + 24; // Card width + gap
      scrollContainerRef.current.scrollTo({
        left: index * cardWidth,
        behavior: 'smooth'
      });
    }
  };

  const scrollLeft = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    setCurrentIndex(newIndex);
    scrollToIndex(newIndex);
  };

  const scrollRight = () => {
    const newIndex = Math.min(maxIndex, currentIndex + 1);
    setCurrentIndex(newIndex);
    scrollToIndex(newIndex);
  };

  const handleSearch = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    setIsLoadingSearch(true);
    const token = getAuthToken();

    try {
      if (searchMode === 'search') {
        const url = 'https://recommendation-beach-backend-production.up.railway.app/beach/search';
        const response = await axios.get(url, {
          params: {
            search: trimmed,
            limit: 10,
            page: 1,
          },
        });

        const beachResults = response.data.data;
        navigate(`/search?search=${encodeURIComponent(trimmed)}`, {
          state: {
            results: beachResults,
            totalCount: response.data.count,
            currentPage: response.data.page,
            totalPages: Math.ceil(response.data.count / response.data.limit),
            hasMore: response.data.count > response.data.limit,
            searchMode: 'search',
          },
        });
      } else {
        if (!token) {
          alert('Anda harus login untuk mendapatkan rekomendasi personalisasi.');
          setIsLoadingSearch(false);
          return;
        }

        const response = await axios.post('https://recommendation-beach-backend-production.up.railway.app/beach/recommend', {
          preference_text: trimmed,
          top_n: 10
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const recommendedPlaceIds = response.data.recommendations;

        if (recommendedPlaceIds && recommendedPlaceIds.length > 0) {
          const detailedRecommendations = await Promise.all(
            recommendedPlaceIds.map(async (rec) => {
              try {
                const detailResponse = await axios.get(`https://recommendation-beach-backend-production.up.railway.app/beach/${rec.placeId}`, {
                  headers: {
                    Authorization: `Bearer ${token}`
                  }
                });
                return { ...detailResponse.data, score: rec.score }; // Pertahankan score dari rekomendasi
              } catch (detailError) {
                console.error(`Error fetching detail for placeId ${rec.placeId}:`, detailError);
                return null;
              }
            })
          );

          const validRecommendations = detailedRecommendations.filter(Boolean);
          navigate(`/search?search=${encodeURIComponent(trimmed)}`, {
            state: {
              results: validRecommendations,
              totalCount: validRecommendations.length,
              currentPage: 1,
              totalPages: 1,
              hasMore: false,
              searchMode: 'recommend',
            },
          });
        } else {
          navigate(`/search?search=${encodeURIComponent(trimmed)}`, {
            state: {
              results: [],
              totalCount: 0,
              currentPage: 1,
              totalPages: 0,
              hasMore: false,
              searchMode: 'recommend',
            },
          });
        }
      }
    } catch (error) {
      console.error('Error during search:', error);
      let errorMessage;
      if (axios.isAxiosError(error) && error.response && error.response.status === 401) {
        errorMessage = 'Sesi Anda telah habis atau Anda belum login. Silakan login kembali.';
      } else {
        errorMessage = searchMode === 'search'
          ? 'Terjadi kesalahan saat mencari pantai. Silakan coba lagi.'
          : 'Terjadi kesalahan saat mendapatkan rekomendasi. Silakan coba lagi.';
      }
      alert(errorMessage);
      navigate(`/search?search=${encodeURIComponent(trimmed)}`, {
        state: { results: [], error: error.message, searchMode },
      });
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handleNearbySearch = async () => {
    setIsLoadingNearby(true);
    try {
      if (!navigator.geolocation) {
        alert('Geolocation tidak didukung oleh browser ini.');
        setIsLoadingNearby(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const response = await axios.get('https://recommendation-beach-backend-production.up.railway.app/beach/nearby', {
              params: { lat: latitude, lng: longitude, radius: 50, limit: 20, page: 1 },
            });
            const nearbyResults = response.data.data;
            navigate('/search?search=nearby', {
              state: {
                results: nearbyResults,
                isNearbySearch: true,
                userLocation: { lat: latitude, lng: longitude },
                totalCount: response.data.totalCount,
                currentPage: response.data.currentPage,
                totalPages: response.data.totalPages,
                hasMore: response.data.hasMore,
              },
            });
          } catch (error) {
            console.error('Error fetching nearby beaches:', error);
            let errorMessage = 'Gagal mengambil data pantai terdekat. ';
            if (axios.isAxiosError(error) && error.response) {
              errorMessage += `Error server: ${error.response.status}`;
            } else if (axios.isAxiosError(error) && error.request) {
              errorMessage += 'Tidak dapat terhubung ke server.';
            } else {
              errorMessage += error.message;
            }
            alert(errorMessage + ' Silakan coba lagi.');
          } finally {
            setIsLoadingNearby(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMessage = 'Tidak dapat mengakses lokasi Anda. ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Mohon izinkan akses lokasi untuk menemukan pantai terdekat.'; break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Informasi lokasi tidak tersedia.'; break;
            case error.TIMEOUT:
              errorMessage += 'Permintaan lokasi habis waktu.'; break;
            default:
              errorMessage += 'Terjadi kesalahan yang tidak diketahui.'; break;
          }
          alert(errorMessage);
          setIsLoadingNearby(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
      );
    } catch (error) {
      console.error('Error initiating nearby search:', error);
      alert('Terjadi kesalahan saat mencari pantai terdekat.');
      setIsLoadingNearby(false);
    }
  };

  const handleTagClick = (tag) => {
    const currentWords = inputValue.trim().split(/\s+/);
    if (!currentWords.includes(tag)) {
      const newInput = (inputValue + ' ' + tag).trim().replace(/\s+/g, ' ');
      setInputValue(newInput);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleDetailClick = (placeId) => {
    navigate(`/detail/${placeId}`);
  };

  const renderStars = (rating, idx) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const gradientId = `half-star-gradient-${idx}`;
    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={`full-${i}`} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
        </svg>
      );
    }
    if (hasHalfStar) {
      stars.push(
        <svg key="half" className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20">
          <defs>
            <linearGradient id={gradientId}>
              <stop offset="50%" stopColor="currentColor"/>
              <stop offset="50%" stopColor="transparent" stopOpacity="0.3"/>
            </linearGradient>
          </defs>
          <path fill={`url(#${gradientId})`} d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
        </svg>
      );
    }
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg key={`empty-${i}`} className="w-4 h-4 text-gray-300" viewBox="0 0 20 20">
          <path fill="currentColor" d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
        </svg>
      );
    }
    return stars;
  };

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-screen">
        <img
          src={hero}
          alt="heroImage"
          className="absolute inset-0 w-full h-full object-cover brightness-75"
        />
        <div className="relative z-10 flex items-center justify-center min-h-screen text-white text-center px-4 sm:px-6 md:px-10">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Find your dream beach
            </h1>
            <h2 className="text-base sm:text-lg md:text-xl mb-6">
              A Hidden Paradise for Your Perfect Vacation
            </h2>
            <p className="text-sm sm:text-base md:text-lg leading-relaxed">
              Enjoy the stunning natural beauty, soft white sand, and the calming sound of the waves.
              Dream Beach is the ideal destination to relax, adventure, and create unforgettable
              memories with family or loved ones.

            </p>

            {/* Search Box with Mode Toggle */}
            <div className="relative w-full max-w-lg mx-auto mt-10">
              {/* Mode Toggle Buttons */}
              <div className="flex bg-white rounded-full p-1 mb-4 shadow-lg">
                <button
                  onClick={() => setSearchMode('search')}
                  className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                    searchMode === 'search'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => setSearchMode('recommend')}
                  className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all duration-200 ${
                    searchMode === 'recommend'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Recommend
                </button>
              </div>

              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={() => setDropdownVisible(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    searchMode === 'search'
                      ? "Search for beaches by name, location..."
                      : "Describe your ideal beach experience..."
                  }
                  disabled={isLoadingSearch}
                  className="w-full pl-12 pr-16 py-4 text-black rounded-full border border-gray-300 shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-500 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSearch}
                  disabled={isLoadingSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingSearch ? (
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Dropdown */}
              {dropdownVisible && (
                <div
                  ref={dropdownRef}
                  className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 p-4 text-left z-20"
                >
                  {/* Nearby Button */}
                  <div className="mb-4 pb-4 border-b border-gray-100">
                    <button
                      onClick={handleNearbySearch}
                      disabled={isLoadingNearby}
                      className="w-full bg-gray-50 hover:bg-gray-100 text-black px-4 py-3 rounded-lg flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                    >
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                        {isLoadingNearby ? (
                          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-base">
                          {isLoadingNearby ? 'Getting Location...' : 'Nearest Beach'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Find beaches near your current location
                        </div>
                      </div>
                    </button>
                  </div>

                  {/* Popular Tags */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-gray-700">
                      {searchMode === 'search' ? 'Popular Tag:' : 'Example Preferences:'}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {searchMode === 'search' ? (
                        tagOptions.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className="px-3 py-2 rounded-full text-sm border border-gray-200 bg-gray-50 text-gray-700 hover:bg-sky-50 hover:border-sky-200 transition-colors"
                          >
                            {tag}
                          </button>
                        ))
                      ) : (
                        ['Pantai sepi dan tenang', 'Pantai untuk keluarga', 'Pantai dengan air jernih', 'Pantai untuk snorkeling', 'Pantai romantis'].map((example) => (
                          <button
                            key={example}
                            onClick={() => setInputValue(example)}
                            className="px-3 py-2 rounded-full text-sm border border-gray-200 bg-gray-50 text-gray-700 hover:bg-sky-50 hover:border-sky-200 transition-colors"
                          >
                            {example}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 md:px-10 bg-transparent">
        <div className="max-w-screen-lg mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-sky-800 mb-2">
              Best Beach Recommendations
            </h2>
            <p className="text-sky-600 max-w-2xl">
              Discover amazing beaches that are perfect for your dream vacation.
            </p>
          </div>

          {isLoadingRecommend ? (
            <div className="flex justify-center items-center py-20">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading beach recommendations...</p>
              </div>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="relative">
              {/* Navigation Buttons */}
              <button
                onClick={scrollLeft}
                disabled={currentIndex === 0}
                className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center transition-all duration-200 ${
                  currentIndex === 0
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-sky-50 hover:shadow-xl'
                }`}
              >
                <ChevronLeft className="w-6 h-6 text-gray-600" />
              </button>
              <button
                onClick={scrollRight}
                disabled={currentIndex >= maxIndex}
                className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center transition-all duration-200 ${
                  currentIndex >= maxIndex
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:bg-sky-50 hover:shadow-xl'
                }`}
              >
                <ChevronRight className="w-6 h-6 text-gray-600" />
              </button>

              {/* Carousel Container */}
              <div
                ref={scrollContainerRef}
                className="overflow-x-hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <div className="flex gap-6 pb-4">
                  {recommendations.map((beach, idx) => (
                    <div
                      key={beach.place_id}
                      className="flex-shrink-0 w-64 bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col group transition-all duration-300"
                      style={{ minWidth: '256px' }}
                    >
                      <div className="relative h-48">
                        <img
                          src={beach.featured_image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400'}
                          alt={beach.name || beach.place_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => {
                            if (e.target.src !== 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400') {
                              e.target.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400';
                            }
                          }}
                        />
                      </div>
                      <div className="p-4 flex flex-col flex-grow space-y-2">
                        <h3 className="font-bold text-lg text-gray-800 truncate">
                          {beach.name || beach.place_name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className="flex">
                            {renderStars(beach.rating || 0, idx)}
                          </div>
                          <span className="text-sm text-gray-500 mt-px">
                            {(beach.rating || 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-500 text-sm pt-1">
                          <MapPin className="w-4 h-4 mr-1.5 text-sky-500 flex-shrink-0" />
                          <span className="truncate">{beach.address || 'Lokasi tidak tersedia'}</span>
                        </div>
                      </div>
                      {/* Tombol Aksi */}
                      <div className="p-4 pt-2 mt-auto border-t border-gray-100 flex items-center gap-2">
                        <button
                            onClick={() => handleDetailClick(beach.placeId)}
                            className="flex-1 text-sm bg-sky-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-sky-600 transition-colors flex items-center justify-center gap-1"
                        >
                            <Info className="w-4 h-4" />
                            Detail
                        </button>
                        <a
                          href={beach.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-sm bg-gray-100 text-gray-800 px-3 py-2 rounded-lg font-semibold hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Maps
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagination Dots */}
              {maxIndex > 0 && (
                <div className="flex justify-center mt-8">
                    <div className="flex space-x-2">
                        {Array.from({ length: maxIndex + 1 }).map((_, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setCurrentIndex(index);
                                    scrollToIndex(index);
                                }}
                                className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                                    index === currentIndex ? 'bg-sky-500' : 'bg-gray-300 hover:bg-gray-400'
                                }`}
                            />
                        ))}
                    </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-20">
              Tidak ada rekomendasi pantai untuk saat ini.
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default Homepage;