// components/PortfolioCharts.tsx
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, XAxis, YAxis, CartesianGrid, Bar, BarChart } from 'recharts';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import { Navigation, Pagination } from 'swiper/modules';
import { PortfolioValueOverTime } from './PortfolioValueOverTime';

const COLORS = ['#00C49F', '#FFBB28'];

interface PortfolioChartsProps {
  credits: number;
  totalValue: number;
  totalSpent: number;
}

export function PortfolioCharts({ credits, totalValue: totalValue, totalSpent }: PortfolioChartsProps) {
  const unrealized = totalValue - credits;
  const unrealizedGain = unrealized - totalSpent;

  const pieData = [
    { name: 'Realized (Cash)', value: credits },
    { name: 'Unrealized (Stocks)', value: unrealized },
  ];

  const gainData = [
    { name: 'Spent', value: totalSpent },
    { name: 'Unrealized Gain', value: unrealizedGain },
  ];

  return (
    <section style={{ margin: '2rem 0' }}>
      <Swiper
        spaceBetween={20}
        slidesPerView={1}
        pagination={{ clickable: true }}
        navigation={true}
        grabCursor={true}
        modules={[Navigation, Pagination]}
        style={{ paddingBottom: '3rem' }}>
        <SwiperSlide>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {pieData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </SwiperSlide>

        <SwiperSlide>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={gainData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </SwiperSlide>

        <SwiperSlide>
          <PortfolioValueOverTime/>
        </SwiperSlide>
      </Swiper>
    </section>
  );
}
